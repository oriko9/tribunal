// Domain types for the Tribunal.
//
// Everything the run depends on — the case, the rules, the seven prompts, the
// model assignment — is read from disk at run time. Nothing about the case or
// the agents is written into this codebase.

export type AgentRole = "advocate" | "judge";

/** The `output_contract` block of a prompt file: a field name -> its description. */
export interface OutputContract {
  format: string;
  fields: Record<string, string>;
}

/** One of the seven prompt files under prompts/. */
export interface PromptFile {
  /** Repo-relative path, recorded in the run file so every call is traceable. */
  path: string;
  schema_version: number;
  id: string;
  version: string;
  display_name: string;
  role: AgentRole;
  /** Advocates only: defence or prosecution. Procedural role, never a conclusion. */
  seat: string | null;
  /** Judges only. */
  method_signal: string | null;
  disclaimer: string | null;
  system_prompt: string;
  output_contract: OutputContract;
}

/**
 * prompts/_shared.yaml. The rules are kept as an open map rather than three
 * named fields, so a rule added to that file reaches all seven agents without
 * a code change.
 */
export interface SharedRules {
  path: string;
  schema_version: number;
  version: string;
  rules: Record<string, string>;
}

/**
 * specs/charge-sheet.yaml. `source` is the literal file text: agents are given
 * the specification verbatim rather than a re-serialisation of it.
 */
export interface ChargeSheet {
  path: string;
  source: string;
  schema_version: number;
  spec_version: string;
  case_id: string;
  case_title: string;
  agreed_fact_ids: string[];
  permitted_verdicts: string[];
}

/** config/run-single.yaml or config/run-multi.yaml, with `default` resolved. */
export interface RunConfig {
  path: string;
  schema_version: number;
  mode: string;
  label: string;
  default_model: string;
  /** agent id -> the model id that seat will use on this run. */
  models: Record<string, string>;
  max_usd_per_run: number | null;
}

/** Everything loaded from disk for one run. */
export interface RunInputs {
  chargeSheet: ChargeSheet;
  shared: SharedRules;
  advocates: PromptFile[];
  judges: PromptFile[];
  config: RunConfig;
}

export type PricingBasis = "provider" | "synthetic" | "unavailable";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** null when the provider did not report a cost. Never estimated. */
  cost_usd: number | null;
  pricing: PricingBasis;
}

export type CallStatus = "ok" | "failed" | "not_run";

export type FailureKind =
  | "transport"
  | "empty_response"
  | "malformed_json"
  | "contract_mismatch"
  | "declared_refusal"
  | "not_run";

export interface FailureRecord {
  kind: FailureKind;
  message: string;
}

/** One of the seven model calls, as recorded in the run file. */
export interface CallRecord {
  agent_id: string;
  display_name: string;
  role: AgentRole;
  seat: string | null;
  prompt_path: string;
  prompt_version: string;
  model: string;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  /** The model's reply, byte for byte. Never edited, never repaired. */
  raw_text: string | null;
  /** The parsed reply. Present only when the text parsed as JSON. */
  output: unknown | null;
  /** "strict" when raw_text parsed directly, "extracted" when a JSON object had to be located inside it. */
  parse: "strict" | "extracted" | null;
  failure: FailureRecord | null;
  usage: Usage | null;
}
