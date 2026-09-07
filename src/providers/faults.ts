// Deliberate faults, injected into the mock provider on demand.
//
// A mock that only ever returns well-formed output cannot exercise the failure
// path, and the verification gates have nothing to catch. This makes failure
// reproducible and selectable per seat:
//
//   TRIBUNAL_MOCK_FAULTS="jon_snow=invalid_json,judge_barak_model=missing_field:verdict"
//
// Every fault is deterministic. A typo in the spec is fatal rather than
// ignored: a fault silently not injected would look like a clean run.

import { ProviderError, TribunalError } from "../errors.js";

export type FaultKind =
  /** Text that is not JSON at all. */
  | "invalid_json"
  /** Well-formed JSON that is missing a field the contract requires. */
  | "missing_field"
  /** A verdict or stance outside the values the charge sheet permits. */
  | "illegal_verdict"
  /** No content at all. */
  | "empty"
  /** Valid JSON, but wrapped in a markdown fence the contract forbids. */
  | "fenced_json"
  /** The agent declares, in the designated field, that it could not answer. */
  | "declared_refusal"
  /** The call never comes back. */
  | "transport_error"
  /** A fact identifier that does not exist in the charge sheet's agreed_facts. */
  | "fabricated_fact";

export const FAULT_KINDS: readonly FaultKind[] = [
  "invalid_json",
  "missing_field",
  "illegal_verdict",
  "empty",
  "fenced_json",
  "declared_refusal",
  "transport_error",
  "fabricated_fact",
];

export interface Fault {
  kind: FaultKind;
  /** Which field to drop, or which illegal verdict to use. Optional. */
  argument: string | null;
}

export const FAULT_ENV_VAR = "TRIBUNAL_MOCK_FAULTS";

const WHERE = `${FAULT_ENV_VAR}`;

/**
 * Parses "agent=kind[:argument],agent=kind" into a fault per seat.
 * Unknown agent ids and unknown fault kinds are fatal.
 */
export function parseFaultSpec(spec: string, knownAgentIds: readonly string[]): Map<string, Fault> {
  const faults = new Map<string, Fault>();
  const entries = spec
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      throw new TribunalError(`entry [${entry}] is not of the form agent=fault`, WHERE);
    }
    const agentId = entry.slice(0, separator).trim();
    const rest = entry.slice(separator + 1).trim();

    if (!knownAgentIds.includes(agentId)) {
      throw new TribunalError(
        `names agent [${agentId}], which is not one of: ${knownAgentIds.join(", ")}`,
        WHERE,
      );
    }
    if (faults.has(agentId)) {
      throw new TribunalError(`names agent [${agentId}] more than once`, WHERE);
    }

    const colon = rest.indexOf(":");
    const kind = (colon === -1 ? rest : rest.slice(0, colon)).trim();
    const argument = colon === -1 ? null : rest.slice(colon + 1).trim();

    if (!FAULT_KINDS.includes(kind as FaultKind)) {
      throw new TribunalError(
        `names fault [${kind}], which is not one of: ${FAULT_KINDS.join(", ")}`,
        WHERE,
      );
    }
    faults.set(agentId, { kind: kind as FaultKind, argument: argument === "" ? null : argument });
  }
  return faults;
}

export function faultsFromEnv(
  env: NodeJS.ProcessEnv,
  knownAgentIds: readonly string[],
): Map<string, Fault> {
  const spec = env[FAULT_ENV_VAR];
  if (spec === undefined || spec.trim() === "") return new Map();
  return parseFaultSpec(spec, knownAgentIds);
}

export interface FaultContext {
  agentId: string;
  /** Field names the seat's output contract requires. */
  contractFields: readonly string[];
  /** Verdicts the charge sheet permits, so an illegal one can be guaranteed illegal. */
  permittedVerdicts: readonly string[];
}

/**
 * Turns a well-formed reply into the requested faulty one and returns the raw
 * text the mock will hand back. `transport_error` throws instead of returning.
 */
export function applyFault(
  fault: Fault,
  reply: Record<string, unknown>,
  context: FaultContext,
): string {
  const faulty: Record<string, unknown> = { ...reply };

  switch (fault.kind) {
    case "transport_error":
      throw new ProviderError(
        fault.argument ?? "injected transport failure: the model was not reached",
        context.agentId,
      );

    case "empty":
      return "";

    case "invalid_json": {
      // Truncating a JSON object always yields text that cannot parse, and it
      // is what a cut-off response actually looks like.
      const text = JSON.stringify(faulty, null, 2);
      return text.slice(0, Math.max(1, Math.floor(text.length * 0.7)));
    }

    case "fenced_json":
      return ["```json", JSON.stringify(faulty, null, 2), "```"].join("\n");

    case "missing_field": {
      const field = fault.argument ?? context.contractFields[0];
      if (field === undefined) {
        throw new TribunalError(`cannot drop a field: ${context.agentId} has no contract fields`, WHERE);
      }
      if (!(field in faulty)) {
        throw new TribunalError(
          `cannot drop field [${field}]: ${context.agentId} does not produce it`,
          WHERE,
        );
      }
      delete faulty[field];
      return JSON.stringify(faulty, null, 2);
    }

    case "illegal_verdict": {
      const field = "verdict" in faulty ? "verdict" : "stance" in faulty ? "stance" : null;
      if (field === null) {
        throw new TribunalError(
          `cannot set an illegal verdict: ${context.agentId} produces neither verdict nor stance`,
          WHERE,
        );
      }
      const value = fault.argument ?? "guilty_with_reservations";
      if (context.permittedVerdicts.includes(value)) {
        throw new TribunalError(
          `verdict [${value}] is permitted by the charge sheet, so it is not a fault`,
          WHERE,
        );
      }
      faulty[field] = value;
      return JSON.stringify(faulty, null, 2);
    }

    case "declared_refusal": {
      if (!("refusal" in faulty)) {
        throw new TribunalError(
          `cannot declare a refusal: ${context.agentId} has no refusal field`,
          WHERE,
        );
      }
      faulty["refusal"] =
        fault.argument ?? "Injected refusal: the record does not let me answer the question put.";
      return JSON.stringify(faulty, null, 2);
    }

    case "fabricated_fact": {
      // "facts_relied_on" plants the fault in the citation list; anything
      // else (the default) plants it in prose, since the gate is built to
      // catch the fluent failure — a well-written opinion resting on a fact
      // that was never in the record, not only a bad citation list.
      const target = fault.argument ?? "prose";
      const bogusId = "F99"; // never a real agreed fact in this charge sheet

      if (target === "facts_relied_on") {
        if (!("facts_relied_on" in faulty) || !Array.isArray(faulty["facts_relied_on"])) {
          throw new TribunalError(
            `cannot inject a fabricated fact into facts_relied_on: ${context.agentId} has none`,
            WHERE,
          );
        }
        faulty["facts_relied_on"] = [...(faulty["facts_relied_on"] as unknown[]), bogusId];
        return JSON.stringify(faulty, null, 2);
      }

      const proseField = "opinion" in faulty ? "opinion" : "argument" in faulty ? "argument" : null;
      if (proseField === null) {
        throw new TribunalError(
          `cannot inject a fabricated fact into prose: ${context.agentId} produces neither opinion nor argument`,
          WHERE,
        );
      }
      faulty[proseField] =
        `${String(faulty[proseField])} This also rests on ${bogusId}, which does not appear in the charge sheet.`;
      return JSON.stringify(faulty, null, 2);
    }
  }
}
