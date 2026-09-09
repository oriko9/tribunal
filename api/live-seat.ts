// One live model call, for exactly one seat, triggered from the browser.
//
// Design constraint: a full deliberation takes 56-96s and Vercel's free
// functions time out at 60s (see docs/mode-a-vs-b.md). Rather than one long
// invocation, the browser calls this endpoint once per seat — four advocates
// in parallel, then three judges in parallel — and assembles the result
// itself. Every individual call ran 5-33s in mode A's live runs, comfortably
// inside the limit. See public/app.js for the orchestration.
//
// This reuses callAgent(), the exact function the CLI's deliberate() calls
// for each seat — not a second copy of it. Both paths share every gate and
// every failure shape by construction.
//
// The mode is fixed. Live runs use mode A (config/run-single.yaml) only, per
// instruction: mode B is slower, costs more, and the archive already shows a
// real mode B run for anyone who wants one. resolveLiveSeat() below reads
// only `agentId` from the request body — nothing else in the body is ever
// read, so a client-supplied "mode" or "model" field has no code path that
// could reach the model choice. That property is checked directly in
// src/smoke.ts ("the live endpoint's mode and model are fixed server-side").

import { loadRunInputs } from "../src/load.js";
import { buildAdvocateMessages, buildJudgeMessages } from "../src/messages.js";
import type { AdvocateSubmission } from "../src/messages.js";
import { callAgent } from "../src/orchestrator.js";
import { API_KEY_ENV_VAR, OpenRouterProvider } from "../src/providers/openrouter.js";
import type { PromptFile, RunInputs } from "../src/types.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Best-effort, per-instance concurrency guard: not a database, not shared
// across Vercel instances under real load, and not the real financial
// backstop. The real backstop is the OpenRouter key's own account-level
// spending cap, which this project has already relied on and seen enforced
// in production (docs/models.md, 09-07 payment-cap incident: a call rejected
// with HTTP 402 before it could spend past the key's limit). This counter
// exists to keep a handful of concurrent visitors from queueing up dozens of
// calls against one warm instance; it is not asked to do more than that.
const MAX_IN_FLIGHT = 8;
let inFlight = 0;

export type SeatResolution =
  | { ok: true; inputs: RunInputs; prompt: PromptFile; model: string }
  | { ok: false; status: number; error: string };

/**
 * Resolves which prompt and which model answer a request, from the request
 * body's `agentId` alone. Every other field the caller might send — mode,
 * model, config, anything — is never read here. The mode is not "usually"
 * mode A: `loadRunInputs("single")` is a literal argument, not a value
 * derived from the request, so there is no input that reaches this line and
 * changes it. This is what stops a stranger pointing this key at model B's
 * pricier lineup, or any model not already named in config/run-single.yaml.
 */
export async function resolveLiveSeat(rawBody: unknown): Promise<SeatResolution> {
  const inputs = await loadRunInputs("single");

  const agentId =
    rawBody !== null && typeof rawBody === "object" && "agentId" in rawBody
      ? (rawBody as Record<string, unknown>)["agentId"]
      : undefined;
  if (typeof agentId !== "string" || agentId.trim() === "") {
    return { ok: false, status: 400, error: "missing agentId" };
  }

  const prompt = [...inputs.advocates, ...inputs.judges].find((p) => p.id === agentId);
  if (prompt === undefined) {
    return { ok: false, status: 400, error: `unknown agent id: ${agentId}` };
  }

  return { ok: true, inputs, prompt, model: inputs.config.models[prompt.id] ?? "" };
}

function seatMeta(inputs: RunInputs, provider: OpenRouterProvider) {
  return {
    case: {
      id: inputs.chargeSheet.case_id,
      title: inputs.chargeSheet.case_title,
      spec: inputs.chargeSheet.path,
      spec_version: inputs.chargeSheet.spec_version,
    },
    mode: inputs.config.mode,
    label: inputs.config.label,
    config: inputs.config.path,
    provider: { name: provider.name, pricing: provider.pricing, description: provider.describe() },
    shared_rules: { path: inputs.shared.path, version: inputs.shared.version },
    budget_usd: inputs.config.max_usd_per_run,
    // Static identity for every seat, so the browser can render a "did not
    // sit" judge card for a seat it never called (advocate phase failed)
    // without guessing at that seat's display name, model, or prompt path.
    seats: [...inputs.advocates, ...inputs.judges].map((p) => ({
      agent_id: p.id,
      display_name: p.display_name,
      role: p.role,
      seat: p.seat,
      prompt_path: p.path,
      prompt_version: p.version,
      model: inputs.config.models[p.id] ?? "",
    })),
  };
}

function parseBody(req: VercelRequest): unknown {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (inFlight >= MAX_IN_FLIGHT) {
    res.status(429).json({
      error: `the site is at its concurrent live-run limit (${MAX_IN_FLIGHT} calls in flight) — try again shortly`,
    });
    return;
  }

  const apiKey = process.env[API_KEY_ENV_VAR];
  if (apiKey === undefined || apiKey.trim() === "") {
    res.status(500).json({ error: "live runs are not configured on this deployment" });
    return;
  }

  inFlight += 1;
  try {
    const body = parseBody(req);
    const resolution = await resolveLiveSeat(body);
    if (!resolution.ok) {
      res.status(resolution.status).json({ error: resolution.error });
      return;
    }
    const { inputs, prompt, model } = resolution;
    const provider = new OpenRouterProvider(apiKey);

    let messages;
    if (prompt.role === "advocate") {
      messages = buildAdvocateMessages(inputs.shared, prompt, inputs.chargeSheet);
    } else {
      // TRUST BOUNDARY: because this endpoint is one stateless invocation per
      // seat, a judge's advocate arguments cannot be kept server-side between
      // phase 1 and phase 2 the way the CLI's deliberate() keeps them in
      // memory for one whole run. The browser relays each advocate's raw_text
      // back to us for the judge call. That means a caller who talks to this
      // endpoint directly, rather than through the page, could feed a judge
      // text no advocate here ever produced — this endpoint cannot tell the
      // difference between "the browser faithfully replayed what it was
      // given" and "someone fabricated an argument and pasted it in."
      //
      // This is an honest consequence of the one-invocation-per-seat design
      // asked for here, not a bug to patch: closing it needs server-side
      // state to hold the real advocate replies across the two phases, and
      // this project has none, by design (CLAUDE.md: "No database"). A live
      // run is a demonstration of the pipeline, not a new source of record —
      // the committed files in runs/ remain the only trusted record, because
      // those come from one process holding everything in memory for the
      // whole run, never from text relayed by a browser. See the note next
      // to the live-run button on the page itself.
      const raw = body as Record<string, unknown>;
      const submitted = Array.isArray(raw["submissions"]) ? (raw["submissions"] as unknown[]) : [];
      const byId = new Map<string, string>();
      for (const entry of submitted) {
        if (entry !== null && typeof entry === "object") {
          const e = entry as Record<string, unknown>;
          if (typeof e["agent_id"] === "string" && typeof e["raw_text"] === "string") {
            byId.set(e["agent_id"], e["raw_text"]);
          }
        }
      }
      const missing = inputs.advocates.filter((a) => !byId.has(a.id));
      if (missing.length > 0) {
        res.status(400).json({
          error: `missing submission(s) for: ${missing.map((a) => a.id).join(", ")}`,
        });
        return;
      }
      const submissions: AdvocateSubmission[] = inputs.advocates.map((a) => ({
        prompt: a,
        raw_text: byId.get(a.id) ?? "",
      }));
      messages = buildJudgeMessages(inputs.shared, prompt, inputs.chargeSheet, submissions);
    }

    const record = await callAgent(
      provider,
      prompt,
      model,
      messages.system,
      messages.user,
      inputs.chargeSheet,
    );

    res.status(200).json({ record, meta: seatMeta(inputs, provider) });
  } finally {
    inFlight -= 1;
  }
}
