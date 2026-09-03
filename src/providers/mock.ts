// A provider that calls nothing and spends nothing.
//
// It builds each reply from the seat's own output_contract, read from the
// prompt file at run time. Nothing about the shape of a reply is hardcoded
// here: change a contract and the mock follows it. That is deliberate — a mock
// with its own idea of the shape would pass while the real contract drifted.
//
// Its text is unmistakably synthetic. No mock output should ever be readable
// as a judicial opinion.

import type { ChargeSheet, PromptFile, Usage } from "../types.js";
import type { ModelProvider, ModelReply, ModelRequest } from "./types.js";
import { applyFault, type Fault } from "./faults.js";

/** Invented prices, so the cost arithmetic is exercised end to end. */
const SYNTHETIC_PROMPT_USD_PER_MTOK = 0.15;
const SYNTHETIC_COMPLETION_USD_PER_MTOK = 0.6;

/** Deterministic, so two runs of the mock produce the same file. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const FILLER = [
  "This sentence is filler emitted by the mock provider to reach the length the contract asks for.",
  "It refers to fact %F only to show that a fact identifier can be carried through the pipeline.",
  "No reasoning took place and no position is being advanced by this text.",
  "The shape of this reply comes from the output contract in the prompt file, not from the code.",
  "Replace the mock with a live provider and this filler disappears entirely.",
];

function syntheticText(wordCount: number, seed: string, facts: readonly string[]): string {
  const words: string[] = "Synthetic mock output, produced without a model and stating no position."
    .split(" ");
  let index = hash(seed) % FILLER.length;
  while (words.length < wordCount) {
    const fact = facts[index % Math.max(1, facts.length)] ?? "F0";
    words.push(...(FILLER[index % FILLER.length] ?? "").replace("%F", fact).split(" "));
    index += 1;
  }
  const trimmed = words.slice(0, Math.max(1, wordCount));
  const last = trimmed.length - 1;
  trimmed[last] = (trimmed[last] ?? "").replace(/[.,;:]?$/, ".");
  return trimmed.join(" ");
}

function sentence(seed: string, facts: readonly string[]): string {
  const fact = facts[hash(seed) % Math.max(1, facts.length)] ?? "F0";
  return `Synthetic mock sentence for the field, nominally resting on ${fact}.`;
}

/** Picks deterministically but differently per seat, so the three judges do not agree by construction. */
function choose<T>(options: readonly T[], seed: string): T | undefined {
  if (options.length === 0) return undefined;
  return options[hash(seed) % options.length];
}

/**
 * Produces a value for one contract field by reading the field's own
 * description. The descriptions are written for a model; these patterns are
 * the small subset of them that has structure a generator can honour.
 */
function generateField(
  field: string,
  description: string,
  prompt: PromptFile,
  chargeSheet: ChargeSheet,
): unknown {
  const seed = `${prompt.id}:${field}`;
  const facts = chargeSheet.agreed_fact_ids;

  // "null, or a string explaining why you could not answer"
  if (field === "refusal" || /^null\b/i.test(description.trim())) {
    return null;
  }

  // "one of: justified | not_justified | uncertain"
  const oneOf = /one of:\s*(.+)/i.exec(description);
  if (oneOf?.[1] !== undefined) {
    const options = oneOf[1]
      .split("|")
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
    return choose(options, seed) ?? options[0] ?? "";
  }

  // "array of fact identifiers from the charge sheet"
  if (/array of fact identifiers/i.test(description)) {
    const count = 2 + (hash(seed) % Math.max(1, facts.length - 1));
    return facts.slice(0, Math.min(count, facts.length));
  }

  // "object with keys Q1, Q2, Q3, Q4, each a one-sentence answer"
  const keyed = /keys\s+(.+?),\s*each/i.exec(description);
  if (keyed?.[1] !== undefined) {
    const entries = keyed[1]
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    return Object.fromEntries(entries.map((key) => [key, sentence(`${seed}:${key}`, facts)]));
  }

  // "ordered array of 4 to 7 objects, each {step, finding}"
  const objects = /(\d+)\s*to\s*(\d+)\s*objects,\s*each\s*\{([^}]*)\}/i.exec(description);
  if (objects?.[1] !== undefined && objects[3] !== undefined) {
    const count = Number(objects[1]);
    const keys = objects[3]
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    return Array.from({ length: count }, (_unused, position) =>
      Object.fromEntries(
        keys.map((key) => [
          key,
          `${key} ${position + 1}: ${sentence(`${seed}:${position}:${key}`, facts)}`,
        ]),
      ),
    );
  }

  // "200 to 320 words, first person, in character"
  const wordRange = /(\d+)\s*to\s*(\d+)\s*words/i.exec(description);
  if (wordRange?.[1] !== undefined && wordRange[2] !== undefined) {
    const low = Number(wordRange[1]);
    const high = Number(wordRange[2]);
    return syntheticText(low + (hash(seed) % Math.max(1, high - low + 1)), seed, facts);
  }

  // "ordered array of short strings ... each tied to a fact identifier"
  if (/array of short strings/i.test(description)) {
    return facts
      .slice(0, 3)
      .map((fact, position) => `Step ${position + 1} (${fact}): synthetic mock entry.`);
  }

  // "array of strings; points against your own position"
  if (/array of strings/i.test(description)) {
    return [sentence(`${seed}:1`, facts), sentence(`${seed}:2`, facts)];
  }

  // A field whose description is simply the value, such as the speaker's name.
  if (description.trim() === prompt.display_name) {
    return prompt.display_name;
  }

  return sentence(seed, facts);
}

export function buildMockReply(
  prompt: PromptFile,
  chargeSheet: ChargeSheet,
): Record<string, unknown> {
  const reply: Record<string, unknown> = {};
  for (const [field, description] of Object.entries(prompt.output_contract.fields)) {
    reply[field] = generateField(field, description, prompt, chargeSheet);
  }
  return reply;
}

export class MockProvider implements ModelProvider {
  readonly name = "mock";
  readonly pricing: Usage["pricing"] = "synthetic";

  constructor(private readonly faults: Map<string, Fault> = new Map()) {}

  describe(): string {
    const base = "mock provider — synthetic text, invented prices, no network, nothing spent";
    if (this.faults.size === 0) return base;
    const injected = [...this.faults.entries()]
      .map(([agentId, fault]) => `${agentId}=${fault.kind}${fault.argument === null ? "" : `:${fault.argument}`}`)
      .join(", ");
    return `${base}; FAULTS INJECTED: ${injected}`;
  }

  async complete(request: ModelRequest): Promise<ModelReply> {
    // A short deterministic delay, so that four calls running concurrently
    // finish out of order and the run file shows it.
    const delay = 10 + (hash(request.agentId) % 50);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const reply = buildMockReply(request.prompt, request.chargeSheet);
    const fault = this.faults.get(request.agentId);

    // applyFault throws for the transport fault; that propagates to the
    // orchestrator exactly as a real transport failure would.
    const raw_text =
      fault === undefined
        ? JSON.stringify(reply, null, 2)
        : applyFault(fault, reply, {
            agentId: request.agentId,
            contractFields: Object.keys(request.prompt.output_contract.fields),
            permittedVerdicts: request.chargeSheet.permitted_verdicts,
          });

    const prompt_tokens = estimateTokens(`${request.system}\n${request.user}`);
    const completion_tokens = estimateTokens(raw_text);
    const cost_usd =
      (prompt_tokens / 1_000_000) * SYNTHETIC_PROMPT_USD_PER_MTOK +
      (completion_tokens / 1_000_000) * SYNTHETIC_COMPLETION_USD_PER_MTOK;

    return {
      raw_text,
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
        cost_usd: Number(cost_usd.toFixed(8)),
        pricing: "synthetic",
      },
      provider_call_id: null,
    };
  }
}
