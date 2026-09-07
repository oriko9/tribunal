// Renders one run as a protocol a person can read.
//
// This file displays. It does not decide anything. In particular it never
// merges, ranks, averages or summarises the three opinions, and it never
// derives a majority from them: the three sections below are siblings, printed
// in a fixed order that is not an order of merit. A seat that failed is
// printed as a failure, in place, rather than dropped from the record.

import type { RunFile } from "./runfile.js";
import type { CallRecord, PromptFile, RunInputs } from "./types.js";

/** Fields each role's section presents in its own right; the rest are printed generically. */
const ADVOCATE_HANDLED = new Set(["speaker", "stance", "argument", "facts_relied_on", "concessions", "refusal"]);
const JUDGE_HANDLED = new Set([
  "judge",
  "verdict",
  "protocol_steps",
  "factors_addressed",
  "facts_relied_on",
  "strongest_opposing_point",
  "opinion",
  "refusal",
]);

function field(record: CallRecord, name: string): unknown {
  if (record.output === null || typeof record.output !== "object") return undefined;
  return (record.output as Record<string, unknown>)[name];
}

/** Flattens a value onto one line, safe to place inside a table cell. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function joinList(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => cell(entry)).join(", ");
  return cell(value);
}

function paragraphs(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return "_not provided_";
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

function bulletList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "_none stated_";
  return value.map((entry) => `- ${typeof entry === "string" ? entry.trim() : cell(entry)}`).join("\n");
}

/** An ordered array of {step, finding} objects, or whatever else the contract asked for. */
function numberedSteps(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "_not provided_";
  return value
    .map((entry, index) => {
      if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
        const parts = Object.entries(entry as Record<string, unknown>)
          .map(([key, inner]) => `**${key}:** ${cell(inner)}`)
          .join("  \n   ");
        return `${index + 1}. ${parts}`;
      }
      return `${index + 1}. ${cell(entry)}`;
    })
    .join("\n");
}

function keyedTable(value: unknown, keyHeader: string, valueHeader: string): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "_not provided_";
  const rows = Object.entries(value as Record<string, unknown>).map(
    ([key, inner]) => `| ${cell(key)} | ${cell(inner)} |`,
  );
  if (rows.length === 0) return "_not provided_";
  return [`| ${keyHeader} | ${valueHeader} |`, "|---|---|", ...rows].join("\n");
}

function extraFields(record: CallRecord, prompt: PromptFile | undefined, handled: Set<string>): string {
  if (prompt === undefined) return "";
  const extras = Object.keys(prompt.output_contract.fields).filter((name) => !handled.has(name));
  if (extras.length === 0) return "";
  const blocks = extras.map((name) => {
    const value = field(record, name);
    const rendered = Array.isArray(value) ? bulletList(value) : paragraphs(value);
    return `**${name}**\n\n${rendered}`;
  });
  return `\n${blocks.join("\n\n")}\n`;
}

/**
 * Shown next to the seat regardless of status: a deviation never disqualifies
 * a reply, so it appears whether the seat's record is otherwise "ok" or
 * failed for an unrelated reason.
 */
function deviationsBlock(record: CallRecord): string {
  if (record.deviations.length === 0) return "";
  const lines = ["", "**Deviations from the contract**", ""];
  for (const deviation of record.deviations) {
    lines.push(`- \`${deviation.field}\` (${deviation.kind}): ${cell(deviation.message)}`);
  }
  return lines.join("\n");
}

function failureBlock(record: CallRecord): string {
  const lines: string[] = [];
  const kind = record.failure?.kind ?? "unknown";
  lines.push(
    record.status === "not_run"
      ? "**This seat did not sit.**"
      : "**This seat produced no usable output.**",
  );
  lines.push("");
  lines.push(`- Status: \`${record.status}\``);
  lines.push(`- Failure: \`${kind}\``);
  lines.push(`- Reason: ${cell(record.failure?.message ?? "not recorded")}`);
  if (record.raw_text !== null) {
    lines.push("");
    lines.push("What the model returned, unaltered:");
    lines.push("");
    lines.push("```");
    lines.push(record.raw_text.slice(0, 2000));
    lines.push("```");
  }
  lines.push("");
  lines.push(
    "_Nothing has been substituted for this seat. A failure is reported as a failure._",
  );
  return lines.join("\n");
}

function advocateSection(record: CallRecord, prompt: PromptFile | undefined): string {
  const seat = record.seat === null ? "advocate" : record.seat;
  const heading = `### ${record.display_name} — ${seat}`;

  if (record.status !== "ok") {
    return [heading, "", failureBlock(record), deviationsBlock(record)].join("\n");
  }

  const lines = [
    heading,
    "",
    `**Stance:** \`${cell(field(record, "stance"))}\`  `,
    `**Facts relied on:** ${joinList(field(record, "facts_relied_on"))}`,
    "",
    paragraphs(field(record, "argument")),
    "",
    "**Concessions**",
    "",
    bulletList(field(record, "concessions")),
  ];
  const extras = extraFields(record, prompt, ADVOCATE_HANDLED);
  if (extras !== "") lines.push(extras);
  lines.push(deviationsBlock(record));
  return lines.join("\n");
}

function opinionSection(record: CallRecord, prompt: PromptFile | undefined): string {
  const heading = `### ${record.display_name}`;

  if (record.status !== "ok") {
    const disclaimer = prompt?.disclaimer;
    return [
      heading,
      "",
      ...(disclaimer === undefined || disclaimer === null ? [] : [`_${disclaimer.trim()}_`, ""]),
      failureBlock(record),
      deviationsBlock(record),
    ].join("\n");
  }

  const lines = [heading, ""];
  if (prompt?.disclaimer !== undefined && prompt.disclaimer !== null) {
    lines.push(`_${prompt.disclaimer.trim()}_`, "");
  }
  lines.push(`**Verdict:** \`${cell(field(record, "verdict"))}\``, "");
  lines.push("**How this verdict was reached**", "");
  lines.push(numberedSteps(field(record, "protocol_steps")), "");
  lines.push("**The four factors the tribunal must weigh**", "");
  lines.push(keyedTable(field(record, "factors_addressed"), "Factor", "Answer"), "");
  lines.push(`**Facts relied on:** ${joinList(field(record, "facts_relied_on"))}`, "");
  lines.push(
    `**Strongest point against this conclusion:** ${paragraphs(field(record, "strongest_opposing_point"))}`,
    "",
  );
  lines.push("**Opinion**", "", paragraphs(field(record, "opinion")));
  const extras = extraFields(record, prompt, JUDGE_HANDLED);
  if (extras !== "") lines.push(extras);
  lines.push(deviationsBlock(record));
  return lines.join("\n");
}

function money(value: number, pricing: string): string {
  const amount = `$${value.toFixed(6)}`;
  return pricing === "synthetic" ? `${amount} (synthetic)` : amount;
}

export function renderProtocol(runFile: RunFile, inputs: RunInputs): string {
  const prompts = new Map<string, PromptFile>();
  for (const prompt of [...inputs.advocates, ...inputs.judges]) prompts.set(prompt.id, prompt);

  const { run, usage } = runFile;
  const out: string[] = [];

  out.push(`# Tribunal protocol — ${run.case.id}, ${run.case.title}`);
  out.push("");
  out.push(
    `Run \`${run.id}\` · charge sheet \`${run.case.spec}\` spec_version ${run.case.spec_version} · mode ${run.mode}`,
  );
  out.push("");
  out.push(
    "> Three judges sat. Each read the charge sheet and all four arguments, wrote",
    "> independently, and saw neither the other judges nor their opinions. The three",
    "> opinions below are reported side by side and are **not combined**: they are not",
    "> merged, ranked, averaged or summarised, and no majority, consensus or overall",
    "> verdict is derived from them. The order they appear in is fixed and is not an",
    "> order of merit.",
  );
  out.push("");

  // --- the run -------------------------------------------------------------
  out.push("## The run");
  out.push("");
  out.push("| Field | Value |");
  out.push("|---|---|");
  out.push(`| Case | ${cell(run.case.id)} — ${cell(run.case.title)} |`);
  out.push(`| Charge sheet | \`${run.case.spec}\`, spec_version ${run.case.spec_version} |`);
  out.push(`| Configuration | \`${run.config}\` — ${cell(run.mode)} (${cell(run.label)}) |`);
  out.push(`| Provider | ${cell(run.provider.description)} |`);
  out.push(`| Pricing basis | ${cell(run.provider.pricing)} |`);
  out.push(`| Shared rules | \`${run.shared_rules.path}\` v${run.shared_rules.version} |`);
  out.push(`| Started | ${run.started_at} |`);
  out.push(`| Ended | ${run.ended_at} |`);
  out.push(`| Duration | ${(run.duration_ms / 1000).toFixed(2)} s |`);
  out.push(
    `| Status | ${run.status === "complete" ? "complete — all seven seats returned usable output" : `**incomplete — ${usage.totals.calls_failed} of ${usage.calls.length} seats failed**`} |`,
  );
  out.push("");

  if (run.failures.length > 0) {
    out.push("**Failures in this run**");
    out.push("");
    for (const failure of run.failures) out.push(`- ${cell(failure)}`);
    out.push("");
  }

  out.push("### The seven seats");
  out.push("");
  out.push("| Seat | Role | Prompt | Version | Model |");
  out.push("|---|---|---|---|---|");
  for (const record of [...runFile.advocates, ...Object.values(runFile.opinions)]) {
    const role = record.seat === null ? record.role : `${record.role} (${record.seat})`;
    out.push(
      `| ${cell(record.display_name)} | ${cell(role)} | \`${record.prompt_path}\` | ${cell(record.prompt_version)} | \`${cell(record.model)}\` |`,
    );
  }
  out.push("");

  // --- the advocates -------------------------------------------------------
  out.push("## The advocates");
  out.push("");
  out.push(
    "Four advocates addressed the Tribunal. Each wrote from the charge sheet alone,",
    "and none of them saw another advocate's argument. A seat holds a procedural",
    "role only: it does not fix the conclusion the advocate reaches.",
  );
  out.push("");
  for (const record of runFile.advocates) {
    out.push(advocateSection(record, prompts.get(record.agent_id)));
    out.push("");
  }

  // --- the opinions --------------------------------------------------------
  out.push("## The opinions");
  out.push("");
  out.push(
    "Three independent opinions follow, as three sibling sections. They are printed",
    "in a fixed order and are not combined in any way.",
  );
  out.push("");
  for (const record of Object.values(runFile.opinions)) {
    out.push(opinionSection(record, prompts.get(record.agent_id)));
    out.push("");
  }

  // --- cost ----------------------------------------------------------------
  out.push("## Cost");
  out.push("");
  out.push("| Seat | Model | Status | Prompt tokens | Completion tokens | Total tokens | Cost (USD) |");
  out.push("|---|---|---|---|---|---|---|");
  for (const row of usage.calls) {
    out.push(
      `| ${cell(row.agent_id)} | \`${cell(row.model)}\` | ${cell(row.status)} | ${row.prompt_tokens ?? "—"} | ${row.completion_tokens ?? "—"} | ${row.total_tokens ?? "—"} | ${row.cost_usd === null ? "—" : row.cost_usd.toFixed(6)} |`,
    );
  }
  const totals = usage.totals;
  out.push(
    `| **Run total** | | ${totals.calls_ok} ok, ${totals.calls_failed} failed | **${totals.prompt_tokens}** | **${totals.completion_tokens}** | **${totals.total_tokens}** | **${money(totals.cost_usd, totals.pricing)}** |`,
  );
  out.push("");
  if (totals.pricing === "synthetic") {
    out.push(
      "Prices in this run are invented by the mock provider. No money was spent and",
      "no figure here should be read as a real cost.",
    );
    out.push("");
  }
  if (totals.cost_is_partial) {
    out.push(
      "At least one call reported no cost. The total is therefore a floor, not a",
      "complete figure: nothing has been estimated to fill the gap.",
    );
    out.push("");
  }
  if (totals.budget_usd !== null) {
    out.push(
      `Budget for this run: $${totals.budget_usd.toFixed(2)}. ` +
        (totals.budget_exceeded ? "**Exceeded.**" : "Not exceeded."),
    );
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push(
    `Generated from \`runs/${run.id}.json\`, which holds the same run as the machine record.`,
    "Every opinion above is reproduced as its seat returned it.",
  );
  out.push("");

  return out.join("\n");
}
