// The one serverless function on this project. It reads an already-committed
// run file from runs/ and returns it — nothing more.
//
// It never imports anything from src/providers, never reads OPENROUTER_API_KEY,
// and never calls a model. A live deliberation takes 56-96s depending on mode;
// Vercel's free serverless functions time out at 60s, so triggering a live run
// from a click would fail intermittently and spend money on every attempt.
// Deliberation runs from the CLI and is committed before it can be viewed here.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const RUNS_DIR = join(process.cwd(), "runs");
// Matches runId() in src/runfile.ts: an ISO timestamp with ":" and "." turned
// into "-". Anything else is rejected before it ever reaches the filesystem.
const RUN_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

interface RunSummary {
  id: string;
  mode: string;
  label: string;
  caseId: string;
  caseTitle: string;
  startedAt: string;
  status: string;
  callsOk: number;
  callsFailed: number;
}

async function listRuns(): Promise<RunSummary[]> {
  let entries: string[];
  try {
    entries = (await readdir(RUNS_DIR)).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }

  const summaries: RunSummary[] = [];
  for (const name of entries) {
    const id = name.slice(0, -".json".length);
    if (!RUN_ID_PATTERN.test(id)) continue;
    try {
      const raw = await readFile(join(RUNS_DIR, name), "utf8");
      const data = JSON.parse(raw) as Record<string, any>;
      summaries.push({
        id,
        mode: data.run.mode,
        label: data.run.label,
        caseId: data.run.case.id,
        caseTitle: data.run.case.title,
        startedAt: data.run.started_at,
        status: data.run.status,
        callsOk: data.usage.totals.calls_ok,
        callsFailed: data.usage.totals.calls_failed,
      });
    } catch {
      // A run file that fails to parse is left out of the list rather than
      // taking the whole endpoint down; it stays readable at ?id= for anyone
      // debugging directly against the deployed function's logs.
      continue;
    }
  }

  summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return summaries;
}

async function readRun(id: string): Promise<unknown> {
  const raw = await readFile(join(RUNS_DIR, `${id}.json`), "utf8");
  return JSON.parse(raw);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const idParam = req.query["id"];
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  try {
    if (id === undefined) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.status(200).json({ runs: await listRuns() });
      return;
    }

    if (!RUN_ID_PATTERN.test(id)) {
      res.status(400).json({ error: "invalid run id" });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    res.status(200).json(await readRun(id));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("ENOENT")) {
      res.status(404).json({ error: "run not found" });
      return;
    }
    res.status(500).json({ error: "failed to read run" });
  }
}
