// Entry point. One run of the Tribunal, from the command line.
//
//     npm run tribunal -- single      config/run-single.yaml
//     npm run tribunal -- multi       config/run-multi.yaml
//     npm run tribunal -- path/to.yaml
//
// Exits non-zero if any seat failed or the run went over budget, so a failed
// run cannot be mistaken for a successful one by anything downstream.

import { TribunalError } from "./errors.js";
import { loadRunInputs } from "./load.js";
import { deliberate } from "./orchestrator.js";
import { selectProvider } from "./providers/index.js";
import { buildRunFile, writeRun } from "./runfile.js";
import type { CallRecord } from "./types.js";

function seatLine(record: CallRecord): string {
  const duration = record.duration_ms === null ? "" : ` ${record.duration_ms}ms`;
  const deviationNote =
    record.deviations.length > 0
      ? ` [${record.deviations.length} deviation${record.deviations.length === 1 ? "" : "s"}: ${record.deviations.map((d) => d.field).join(", ")}]`
      : "";
  if (record.status === "ok") {
    const note = record.parse === "extracted" ? " (JSON recovered from a fenced reply)" : "";
    return `  ok      ${record.agent_id}${duration}${note}${deviationNote}`;
  }
  return `  ${record.status === "not_run" ? "skipped" : "FAILED "} ${record.agent_id}${duration} — ${record.failure?.kind}: ${record.failure?.message ?? ""}${deviationNote}`;
}

async function main(): Promise<void> {
  const argument = process.argv[2] ?? "single";

  const inputs = await loadRunInputs(argument);
  const agentIds = [...inputs.advocates, ...inputs.judges].map((prompt) => prompt.id);
  const { provider } = selectProvider(process.env, agentIds, inputs.config.models);

  console.log(`Tribunal — ${inputs.chargeSheet.case_id}, ${inputs.chargeSheet.case_title}`);
  console.log(`  charge sheet  ${inputs.chargeSheet.path} spec_version ${inputs.chargeSheet.spec_version}`);
  console.log(`  configuration ${inputs.config.path} (${inputs.config.mode})`);
  console.log(`  provider      ${provider.describe()}`);
  console.log("");

  console.log(`Phase 1 — ${inputs.advocates.length} advocates, concurrently`);
  const report = await deliberate(inputs, provider);
  for (const record of report.advocates) console.log(seatLine(record));

  console.log(`\nPhase 2 — ${inputs.judges.length} judges, concurrently`);
  for (const record of report.judges) console.log(seatLine(record));

  const runFile = buildRunFile(inputs, provider, report);
  const written = await writeRun(runFile, inputs);

  console.log("\nOpinions returned, side by side and uncombined:");
  for (const record of Object.values(runFile.opinions)) {
    const verdict =
      record.status === "ok"
        ? String((record.output as Record<string, unknown>)["verdict"])
        : `no opinion (${record.failure?.kind})`;
    console.log(`  ${record.display_name.padEnd(20)} ${verdict}`);
  }

  const totals = runFile.usage.totals;
  console.log(
    `\n${totals.total_tokens} tokens, $${totals.cost_usd.toFixed(6)}` +
      (totals.pricing === "synthetic" ? " (synthetic — no money was spent)" : "") +
      (totals.cost_is_partial ? " — a floor: some calls reported no cost" : ""),
  );
  console.log(`  ${written.jsonPath}`);
  console.log(`  ${written.markdownPath}`);

  if (totals.budget_exceeded) {
    console.error(
      `\nOver budget: $${totals.cost_usd.toFixed(6)} against a limit of $${(totals.budget_usd ?? 0).toFixed(2)}.`,
    );
    process.exit(1);
  }
  if (runFile.run.status !== "complete") {
    console.error(`\nRun incomplete: ${totals.calls_failed} of ${runFile.usage.calls.length} seats failed.`);
    console.error("The run file records the failures. Nothing was substituted for them.");
    process.exit(1);
  }
}

try {
  await main();
} catch (cause) {
  if (cause instanceof TribunalError) {
    console.error(`\n${cause.message}`);
    process.exit(1);
  }
  throw cause;
}
