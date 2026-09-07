// Proves the two verification gates against real data, not only synthetic
// fixtures: re-applies today's gates to every already-committed runs/*.json,
// using the real charge sheet and the real prompt contracts, and reports
// what a live model actually returned that the gates at the time did not
// yet catch.
//
// This does not rewrite any committed run file. Each one is the record of
// what the orchestrator actually produced when it ran; the gates it had at
// that moment are part of that history. This script is a read-only audit
// layered on top, run whenever the gates change and someone wants to know
// what they would have caught in runs that already happened.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkContractConformance, checkFactGrounding } from "./gates.js";
import { loadChargeSheet, loadPrompts, repoRoot } from "./load.js";
import type { ChargeSheet, PromptFile } from "./types.js";

interface HistoricalRecord {
  agent_id: string;
  status: string;
  output: Record<string, unknown> | null;
}

interface HistoricalRunFile {
  run: { id: string; mode: string };
  advocates: HistoricalRecord[];
  opinions: Record<string, HistoricalRecord>;
}

function recordsOf(run: HistoricalRunFile): HistoricalRecord[] {
  return [...run.advocates, ...Object.values(run.opinions)];
}

async function main(): Promise<void> {
  const chargeSheet: ChargeSheet = await loadChargeSheet();
  const { advocates, judges } = await loadPrompts();
  const promptsById = new Map<string, PromptFile>();
  for (const prompt of [...advocates, ...judges]) promptsById.set(prompt.id, prompt);

  const runsDir = join(repoRoot, "runs");
  const files = (await readdir(runsDir)).filter((name) => name.endsWith(".json")).sort();

  let callsWithOutput = 0;
  let totalDeviations = 0;
  let newFailures = 0;
  let alreadyFailedButNowDoublyCaught = 0;

  console.log(`Verifying today's gates against ${files.length} committed run file(s) in runs/.\n`);

  for (const file of files) {
    const raw = await readFile(join(runsDir, file), "utf8");
    const run = JSON.parse(raw) as HistoricalRunFile;
    const findings: string[] = [];

    for (const record of recordsOf(run)) {
      if (record.output === null || record.output === undefined) continue; // nothing to gate-check
      const prompt = promptsById.get(record.agent_id);
      if (prompt === undefined) continue;
      callsWithOutput += 1;

      const conformance = checkContractConformance(record.output, prompt);
      const grounding = checkFactGrounding(record.output, chargeSheet);
      const wasOk = record.status === "ok";

      for (const deviation of conformance.deviations) {
        totalDeviations += 1;
        findings.push(
          `  DEVIATION  [${record.agent_id}] ${deviation.field} (${deviation.kind}): ${deviation.message}`,
        );
      }

      for (const failure of [conformance.failure, grounding].filter((f) => f !== null)) {
        if (wasOk) {
          newFailures += 1;
          findings.push(
            `  NEW FAILURE (this run recorded it as ok) [${record.agent_id}] ${failure.kind}: ${failure.message}`,
          );
        } else {
          alreadyFailedButNowDoublyCaught += 1;
          findings.push(
            `  ALSO FAILS (this run already recorded a different failure) [${record.agent_id}] ${failure.kind}: ${failure.message}`,
          );
        }
      }
    }

    if (findings.length > 0) {
      console.log(`${run.run.id} (${run.run.mode})`);
      for (const line of findings) console.log(line);
      console.log("");
    }
  }

  console.log("---");
  console.log(`${files.length} run files scanned, ${callsWithOutput} calls with parsed output checked.`);
  console.log(`${totalDeviations} deviation(s) found.`);
  console.log(
    `${newFailures} finding(s) that would newly fail a call this project's run file recorded as ok at the time.`,
  );
  console.log(
    `${alreadyFailedButNowDoublyCaught} finding(s) on calls already recorded as failed for a different reason.`,
  );
}

await main();
