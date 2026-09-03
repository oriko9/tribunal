// Assembles the record of one run and writes it to runs/.
//
// Two files are written from the same data. The JSON is the machine record.
// The markdown is the same run rendered as a protocol a person can open in
// GitHub without running anything.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./load.js";
import type { ModelProvider } from "./providers/types.js";
import { renderProtocol } from "./protocol.js";
import type { PhaseReport } from "./orchestrator.js";
import type { CallRecord, RunInputs } from "./types.js";

export interface UsageRow {
  agent_id: string;
  role: string;
  model: string;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
}

export interface RunTotals {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  /** True when at least one call reported no cost, so the total is a floor. */
  cost_is_partial: boolean;
  pricing: string;
  calls_ok: number;
  calls_failed: number;
  budget_usd: number | null;
  budget_exceeded: boolean;
}

export interface RunFile {
  schema_version: number;
  run: {
    id: string;
    case: { id: string; title: string; spec: string; spec_version: string };
    mode: string;
    label: string;
    config: string;
    provider: { name: string; pricing: string; description: string };
    shared_rules: { path: string; version: string };
    prompt_versions: Record<string, string>;
    started_at: string;
    ended_at: string;
    duration_ms: number;
    status: "complete" | "incomplete";
    failures: string[];
  };
  /** The four advocate calls, unmodified. */
  advocates: CallRecord[];
  /**
   * The three opinions, as three named siblings. They are never merged,
   * ranked, averaged or summarised, and no majority is derived from them.
   */
  opinions: Record<string, CallRecord>;
  usage: { calls: UsageRow[]; totals: RunTotals };
}

/** Colons are not legal in Windows filenames, so the id uses hyphens. The true instant is inside the file. */
export function runId(startedAt: string): string {
  return startedAt.replace(/:/g, "-").replace(/\./g, "-");
}

function usageRow(record: CallRecord): UsageRow {
  return {
    agent_id: record.agent_id,
    role: record.role,
    model: record.model,
    status: record.status,
    prompt_tokens: record.usage?.prompt_tokens ?? null,
    completion_tokens: record.usage?.completion_tokens ?? null,
    total_tokens: record.usage?.total_tokens ?? null,
    cost_usd: record.usage?.cost_usd ?? null,
  };
}

export function buildRunFile(
  inputs: RunInputs,
  provider: ModelProvider,
  report: PhaseReport,
): RunFile {
  const all = [...report.advocates, ...report.judges];
  const rows = all.map(usageRow);

  const totals: RunTotals = {
    prompt_tokens: rows.reduce((sum, row) => sum + (row.prompt_tokens ?? 0), 0),
    completion_tokens: rows.reduce((sum, row) => sum + (row.completion_tokens ?? 0), 0),
    total_tokens: rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0),
    // Costs that were never reported are not guessed at, so the total is a
    // floor whenever any call is missing one.
    cost_usd: Number(rows.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0).toFixed(8)),
    cost_is_partial: all.some((record) => record.status === "ok" && record.usage?.cost_usd == null),
    pricing: provider.pricing,
    calls_ok: all.filter((record) => record.status === "ok").length,
    calls_failed: all.filter((record) => record.status !== "ok").length,
    budget_usd: inputs.config.max_usd_per_run,
    budget_exceeded: false,
  };
  totals.budget_exceeded =
    totals.budget_usd !== null && totals.cost_usd > totals.budget_usd;

  const promptVersions: Record<string, string> = {};
  for (const prompt of [...inputs.advocates, ...inputs.judges]) {
    promptVersions[prompt.id] = prompt.version;
  }

  const failures = all
    .filter((record) => record.status !== "ok")
    .map((record) => `${record.agent_id}: ${record.failure?.kind ?? "unknown"} — ${record.failure?.message ?? ""}`);

  const opinions: Record<string, CallRecord> = {};
  for (const record of report.judges) {
    opinions[record.agent_id] = record;
  }

  return {
    schema_version: 1,
    run: {
      id: runId(report.started_at),
      case: {
        id: inputs.chargeSheet.case_id,
        title: inputs.chargeSheet.case_title,
        spec: inputs.chargeSheet.path,
        spec_version: inputs.chargeSheet.spec_version,
      },
      mode: inputs.config.mode,
      label: inputs.config.label,
      config: inputs.config.path,
      provider: {
        name: provider.name,
        pricing: provider.pricing,
        description: provider.describe(),
      },
      shared_rules: { path: inputs.shared.path, version: inputs.shared.version },
      prompt_versions: promptVersions,
      started_at: report.started_at,
      ended_at: report.ended_at,
      duration_ms: report.duration_ms,
      status: failures.length === 0 ? "complete" : "incomplete",
      failures,
    },
    advocates: report.advocates,
    opinions,
    usage: { calls: rows, totals },
  };
}

export interface WrittenRun {
  jsonPath: string;
  markdownPath: string;
}

export async function writeRun(runFile: RunFile, inputs: RunInputs): Promise<WrittenRun> {
  const directory = join(repoRoot, "runs");
  await mkdir(directory, { recursive: true });

  const jsonPath = join(directory, `${runFile.run.id}.json`);
  const markdownPath = join(directory, `${runFile.run.id}.md`);

  await writeFile(jsonPath, `${JSON.stringify(runFile, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderProtocol(runFile, inputs), "utf8");

  return { jsonPath, markdownPath };
}
