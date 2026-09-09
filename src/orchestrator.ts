// The protocol itself.
//
//   Phase 1  the four advocates run concurrently. None of them sees another.
//   Phase 2  the three judges run concurrently. Each reads the charge sheet and
//            all four arguments. None of them sees another judge.
//
// Nothing here reads, compares or combines the three opinions. The orchestrator
// records what each seat returned and stops. Three opinions in, three out.

import { ProviderError } from "./errors.js";
import { checkContractConformance, checkFactGrounding } from "./gates.js";
import { buildAdvocateMessages, buildJudgeMessages } from "./messages.js";
import type { AdvocateSubmission } from "./messages.js";
import type { ModelProvider } from "./providers/types.js";
import type { CallRecord, ChargeSheet, PromptFile, RunInputs, SharedRules } from "./types.js";

export interface PhaseReport {
  advocates: CallRecord[];
  judges: CallRecord[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

/** Parsed, or a reason it could not be. The raw text is kept either way. */
interface ParseOutcome {
  output: unknown | null;
  parse: "strict" | "extracted" | null;
  error: string | null;
}

function parseReply(raw: string): ParseOutcome {
  try {
    return { output: JSON.parse(raw), parse: "strict", error: null };
  } catch {
    // A model that wrapped its JSON in prose or a code fence has not returned
    // what the contract asked for. The deviation is recorded rather than
    // hidden: the raw text is kept untouched and `parse` says "extracted".
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return { output: JSON.parse(raw.slice(start, end + 1)), parse: "extracted", error: null };
      } catch (cause) {
        return { output: null, parse: null, error: (cause as Error).message };
      }
    }
    return { output: null, parse: null, error: "no JSON object found in the reply" };
  }
}

function baseRecord(prompt: PromptFile, model: string): CallRecord {
  return {
    agent_id: prompt.id,
    display_name: prompt.display_name,
    role: prompt.role,
    seat: prompt.seat,
    prompt_path: prompt.path,
    prompt_version: prompt.version,
    model,
    status: "not_run",
    started_at: null,
    ended_at: null,
    duration_ms: null,
    raw_text: null,
    output: null,
    parse: null,
    failure: null,
    deviations: [],
    usage: null,
  };
}

/**
 * Runs one seat and records what came back. It never throws: a failed seat is
 * a recorded failure, not an exception that takes the run down. It never
 * substitutes content for a call that failed.
 *
 * Exported so the live-run endpoint (api/live-seat.ts) can call exactly this
 * function for one seat, rather than a second copy of it. Both paths share
 * every gate and every failure shape by construction.
 */
export async function callAgent(
  provider: ModelProvider,
  prompt: PromptFile,
  model: string,
  system: string,
  user: string,
  chargeSheet: ChargeSheet,
): Promise<CallRecord> {
  const record = baseRecord(prompt, model);
  const started = Date.now();
  record.started_at = new Date(started).toISOString();

  const finish = (): void => {
    const ended = Date.now();
    record.ended_at = new Date(ended).toISOString();
    record.duration_ms = ended - started;
  };

  let reply;
  try {
    reply = await provider.complete({ agentId: prompt.id, model, system, user, prompt, chargeSheet });
  } catch (cause) {
    finish();
    record.status = "failed";
    record.failure = {
      kind: "transport",
      message: cause instanceof ProviderError ? cause.message : (cause as Error).message,
    };
    return record;
  }

  finish();
  record.raw_text = reply.raw_text;
  record.usage = reply.usage;

  if (reply.raw_text.trim() === "") {
    record.status = "failed";
    record.failure = { kind: "empty_response", message: "the model returned no content" };
    return record;
  }

  const parsed = parseReply(reply.raw_text);
  if (parsed.output === null || typeof parsed.output !== "object" || Array.isArray(parsed.output)) {
    record.status = "failed";
    record.failure = {
      kind: "malformed_json",
      message: parsed.error ?? "the reply was not a JSON object",
    };
    return record;
  }

  record.output = parsed.output;
  record.parse = parsed.parse;

  const returned = parsed.output as Record<string, unknown>;
  const missing = Object.keys(prompt.output_contract.fields).filter((field) => !(field in returned));
  if (missing.length > 0) {
    record.status = "failed";
    record.failure = {
      kind: "contract_mismatch",
      message: `the reply is missing contract fields: ${missing.join(", ")}`,
    };
    return record;
  }

  // The shared failure rule tells an agent to declare failure in this field
  // rather than invent content. A declaration is honoured as a failure.
  const refusal = returned["refusal"];
  if (typeof refusal === "string" && refusal.trim() !== "") {
    record.status = "failed";
    record.failure = { kind: "declared_refusal", message: refusal };
    return record;
  }

  // Gate 1: the reply parsed and carries every required field, but does it
  // say what its own contract permits, in the shape that contract describes?
  // A shape deviation (a word count, a step count, a missing factor) is
  // recorded and the opinion stands. An illegal verdict or stance is not a
  // result the tribunal can use.
  const conformance = checkContractConformance(returned, prompt);
  record.deviations = conformance.deviations;
  if (conformance.failure !== null) {
    record.status = "failed";
    record.failure = conformance.failure;
    return record;
  }

  // Gate 2: every fact identifier the reply cites, in facts_relied_on or
  // anywhere in its prose, must exist in the charge sheet. Built for the
  // fluent failure: a well-written opinion resting on a fact that was never
  // in the record.
  const grounding = checkFactGrounding(returned, chargeSheet);
  if (grounding !== null) {
    record.status = "failed";
    record.failure = grounding;
    return record;
  }

  record.status = "ok";
  return record;
}

function runAdvocates(
  provider: ModelProvider,
  shared: SharedRules,
  chargeSheet: ChargeSheet,
  advocates: readonly PromptFile[],
  models: Readonly<Record<string, string>>,
): Promise<CallRecord[]> {
  // Concurrent, and each built from the charge sheet alone.
  return Promise.all(
    advocates.map((prompt) => {
      const messages = buildAdvocateMessages(shared, prompt, chargeSheet);
      return callAgent(
        provider,
        prompt,
        models[prompt.id] ?? "",
        messages.system,
        messages.user,
        chargeSheet,
      );
    }),
  );
}

function runJudges(
  provider: ModelProvider,
  shared: SharedRules,
  chargeSheet: ChargeSheet,
  judges: readonly PromptFile[],
  models: Readonly<Record<string, string>>,
  submissions: readonly AdvocateSubmission[],
): Promise<CallRecord[]> {
  return Promise.all(
    judges.map((prompt) => {
      const messages = buildJudgeMessages(shared, prompt, chargeSheet, submissions);
      return callAgent(
        provider,
        prompt,
        models[prompt.id] ?? "",
        messages.system,
        messages.user,
        chargeSheet,
      );
    }),
  );
}

export async function deliberate(
  inputs: RunInputs,
  provider: ModelProvider,
): Promise<PhaseReport> {
  const started = Date.now();
  const { shared, chargeSheet, advocates, judges, config } = inputs;

  const advocateRecords = await runAdvocates(
    provider,
    shared,
    chargeSheet,
    advocates,
    config.models,
  );

  const failedAdvocates = advocateRecords.filter((record) => record.status !== "ok");

  let judgeRecords: CallRecord[];
  if (failedAdvocates.length > 0) {
    // The protocol has each judge read all four arguments. Three of four is a
    // different proceeding, and an opinion produced from it would be a
    // degraded result wearing the shape of a real one. The judges do not sit.
    const reason =
      `the judges did not sit: ${failedAdvocates.length} of ${advocateRecords.length} advocates ` +
      `failed (${failedAdvocates.map((record) => record.agent_id).join(", ")}), and the protocol ` +
      `has every judge read all four arguments`;
    judgeRecords = judges.map((prompt) => {
      const record = baseRecord(prompt, config.models[prompt.id] ?? "");
      record.failure = { kind: "not_run", message: reason };
      return record;
    });
  } else {
    const submissions: AdvocateSubmission[] = advocateRecords.map((record, index) => ({
      // Advocate order follows the loaded prompt order, identical for all three
      // judges, so ordering is not an uncontrolled difference between them.
      prompt: advocates[index] as PromptFile,
      raw_text: record.raw_text ?? "",
    }));
    judgeRecords = await runJudges(
      provider,
      shared,
      chargeSheet,
      judges,
      config.models,
      submissions,
    );
  }

  const ended = Date.now();
  return {
    advocates: advocateRecords,
    judges: judgeRecords,
    started_at: new Date(started).toISOString(),
    ended_at: new Date(ended).toISOString(),
    duration_ms: ended - started,
  };
}
