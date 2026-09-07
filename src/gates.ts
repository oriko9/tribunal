// The two verification gates, applied to what a live model actually returned
// — after it parsed as JSON and carried every field its contract requires.
//
// Two different outcomes, deliberately not conflated:
//
//   FAILURE    the reply is not a result. A verdict outside the space the
//              contract permits, or a fact identifier that does not exist in
//              the charge sheet, is not an opinion the tribunal can use.
//
//   DEVIATION  the reply is still a result. It did not follow every shape its
//              contract described — a word count outside its stated range,
//              too few or too many protocol steps, a missing factor — but
//              the opinion itself is not discarded and a run is not failed
//              for it alone.

import {
  parseEnum,
  parseKeyedObjectFields,
  parseObjectCountRange,
  parseWordRange,
} from "./contract-patterns.js";
import type { ChargeSheet, DeviationRecord, FailureRecord, PromptFile } from "./types.js";

export interface ContractConformance {
  /** Set only for a verdict/stance outside the enum its own contract declares. */
  failure: FailureRecord | null;
  deviations: DeviationRecord[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Checks every field a reply's own contract describes against the shape that
 * description states: word ranges, array-of-objects counts, a keyed object's
 * required keys, and — for `verdict` and `stance` specifically — that the
 * value is one the contract's own enum declares.
 *
 * Judges' `verdict` enum is exactly the charge sheet's `permitted_verdicts`
 * (enforced structurally by a smoke check on the prompt files themselves), so
 * checking a judge against its own contract is checking it against the
 * charge sheet. Advocates' `stance` contract additionally permits
 * "uncertain" — a value the charge sheet's `permitted_verdicts` does not
 * list, because it governs the tribunal's verdict, not an advocate's stance.
 * Validating against each agent's own declared enum keeps that a legitimate
 * value rather than a fault.
 */
export function checkContractConformance(
  output: Record<string, unknown>,
  prompt: PromptFile,
): ContractConformance {
  const deviations: DeviationRecord[] = [];
  let failure: FailureRecord | null = null;

  for (const [field, description] of Object.entries(prompt.output_contract.fields)) {
    const value = output[field];

    const wordRange = parseWordRange(description);
    if (wordRange !== null && typeof value === "string") {
      const [min, max] = wordRange;
      const count = wordCount(value);
      if (count < min || count > max) {
        deviations.push({
          kind: "word_count_out_of_range",
          field,
          message: `${count} words, contract states ${min}-${max}`,
        });
      }
    }

    const objectCountRange = parseObjectCountRange(description);
    if (objectCountRange !== null && Array.isArray(value)) {
      const [min, max] = objectCountRange;
      if (value.length < min || value.length > max) {
        deviations.push({
          kind: "protocol_steps_count_out_of_range",
          field,
          message: `${value.length} entries, contract states ${min}-${max}`,
        });
      }
    }

    const requiredKeys = parseKeyedObjectFields(description);
    if (requiredKeys !== null && value !== null && typeof value === "object" && !Array.isArray(value)) {
      const present = value as Record<string, unknown>;
      const missing = requiredKeys.filter(
        (key) => !(key in present) || String(present[key] ?? "").trim() === "",
      );
      if (missing.length > 0) {
        deviations.push({
          kind: "factors_addressed_incomplete",
          field,
          message: `missing: ${missing.join(", ")}`,
        });
      }
    }

    if ((field === "verdict" || field === "stance") && typeof value === "string") {
      const enumValues = parseEnum(description);
      if (enumValues !== null && !enumValues.includes(value)) {
        failure = {
          kind: "illegal_verdict",
          message: `${field} is [${value}], which is not one of: ${enumValues.join(", ")}`,
        };
      }
    }
  }

  return { failure, deviations };
}

const FACT_ID_PATTERN = /\bF\d+\b/g;

function collectStrings(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, into);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) collectStrings(entry, into);
  }
}

/**
 * Every fact identifier the reply cites — in `facts_relied_on` and anywhere
 * in its prose — must exist in the charge sheet's agreed_facts. This is the
 * check built for the fluent failure: a well-written opinion resting on a
 * fact that was never in the record.
 *
 * The charge sheet's own text names F1 through F5 throughout (each
 * agreed_facts entry states its own id). Quoting or citing one of those real
 * identifiers, however many times, is never flagged: only an identifier
 * matching the pattern that is *not* in agreed_fact_ids is fabricated.
 */
export function checkFactGrounding(
  output: Record<string, unknown>,
  chargeSheet: ChargeSheet,
): FailureRecord | null {
  const cited = new Set<string>();

  const reliedOn = output["facts_relied_on"];
  if (Array.isArray(reliedOn)) {
    for (const id of reliedOn) if (typeof id === "string") cited.add(id);
  }

  const strings: string[] = [];
  collectStrings(output, strings);
  for (const text of strings) {
    for (const match of text.matchAll(FACT_ID_PATTERN)) cited.add(match[0]);
  }

  const fabricated = [...cited]
    .filter((id) => !chargeSheet.agreed_fact_ids.includes(id))
    .sort();

  if (fabricated.length === 0) return null;

  return {
    kind: "fabricated_fact",
    message: `cites fact identifier(s) not in the charge sheet's agreed_facts: ${fabricated.join(", ")}`,
  };
}
