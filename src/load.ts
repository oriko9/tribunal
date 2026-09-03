// Reads every input the run depends on from disk and validates it.
//
// Load failures are fatal and loud. A run that starts from a half-valid
// specification would produce output that looks like a result but is not one.

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { TribunalError } from "./errors.js";
import type {
  AgentRole,
  ChargeSheet,
  OutputContract,
  PromptFile,
  RunConfig,
  RunInputs,
  SharedRules,
} from "./types.js";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const EXPECTED_ADVOCATES = 4;
const EXPECTED_JUDGES = 3;

function rel(absolute: string): string {
  return relative(repoRoot, absolute).replace(/\\/g, "/");
}

async function readYaml(
  absolute: string,
): Promise<{ source: string; data: Record<string, unknown> }> {
  const where = rel(absolute);
  let source: string;
  try {
    source = await readFile(absolute, "utf8");
  } catch (cause) {
    throw new TribunalError(`cannot be read (${(cause as Error).message})`, where);
  }
  let data: unknown;
  try {
    data = parseYaml(source);
  } catch (cause) {
    throw new TribunalError(`is not valid YAML (${(cause as Error).message})`, where);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new TribunalError("must contain a YAML mapping at the top level", where);
  }
  return { source, data: data as Record<string, unknown> };
}

function str(data: Record<string, unknown>, key: string, where: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new TribunalError(`missing or empty string field [${key}]`, where);
  }
  return value;
}

function optionalStr(data: Record<string, unknown>, key: string, where: string): string | null {
  const value = data[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TribunalError(`field [${key}] must be a string if present`, where);
  }
  return value;
}

function num(data: Record<string, unknown>, key: string, where: string): number {
  const value = data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TribunalError(`missing or non-numeric field [${key}]`, where);
  }
  return value;
}

function record(data: Record<string, unknown>, key: string, where: string): Record<string, unknown> {
  const value = data[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TribunalError(`missing or non-mapping field [${key}]`, where);
  }
  return value as Record<string, unknown>;
}

function list(data: Record<string, unknown>, key: string, where: string): unknown[] {
  const value = data[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new TribunalError(`missing or empty list field [${key}]`, where);
  }
  return value;
}

// --- the charge sheet ------------------------------------------------------

export async function loadChargeSheet(): Promise<ChargeSheet> {
  const absolute = join(repoRoot, "specs", "charge-sheet.yaml");
  const where = rel(absolute);
  const { source, data } = await readYaml(absolute);

  const caseBlock = record(data, "case", where);
  const scope = record(data, "scope", where);

  const facts = list(data, "agreed_facts", where).map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TribunalError(`agreed_facts[${index}] must be a mapping`, where);
    }
    const fact = entry as Record<string, unknown>;
    str(fact, "text", `${where} agreed_facts[${index}]`);
    return str(fact, "id", `${where} agreed_facts[${index}]`);
  });
  const duplicate = facts.find((id, index) => facts.indexOf(id) !== index);
  if (duplicate !== undefined) {
    throw new TribunalError(`agreed fact id [${duplicate}] appears more than once`, where);
  }

  const verdicts = list(scope, "permitted_verdicts", `${where} scope`).map((entry, index) => {
    if (typeof entry !== "string") {
      throw new TribunalError(`scope.permitted_verdicts[${index}] must be a string`, where);
    }
    return entry;
  });

  // Validated here, but they reach the agents through the verbatim source below.
  str(data, "background", where);
  record(data, "question_for_judgment", where);

  return {
    path: where,
    source,
    schema_version: num(data, "schema_version", where),
    spec_version: str(data, "spec_version", where),
    case_id: str(caseBlock, "id", `${where} case`),
    case_title: str(caseBlock, "title", `${where} case`),
    agreed_fact_ids: facts,
    permitted_verdicts: verdicts,
  };
}

// --- the shared rules ------------------------------------------------------

export async function loadSharedRules(): Promise<SharedRules> {
  const absolute = join(repoRoot, "prompts", "_shared.yaml");
  const where = rel(absolute);
  const { data } = await readYaml(absolute);

  // Every string field other than the two metadata fields is a rule. Adding a
  // rule to that file is enough to put it in front of all seven agents.
  const rules: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "schema_version" || key === "version") continue;
    if (typeof value !== "string") {
      throw new TribunalError(`rule [${key}] must be a string`, where);
    }
    rules[key] = value;
  }
  if (Object.keys(rules).length === 0) {
    throw new TribunalError("contains no shared rules", where);
  }

  return {
    path: where,
    schema_version: num(data, "schema_version", where),
    version: str(data, "version", where),
    rules,
  };
}

// --- the seven prompts -----------------------------------------------------

function readContract(data: Record<string, unknown>, where: string): OutputContract {
  const block = record(data, "output_contract", where);
  const fields = record(block, "fields", `${where} output_contract`);
  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") {
      throw new TribunalError(`output_contract.fields.${key} must be a string`, where);
    }
    parsed[key] = value;
  }
  if (Object.keys(parsed).length === 0) {
    throw new TribunalError("output_contract.fields is empty", where);
  }
  return { format: str(block, "format", `${where} output_contract`), fields: parsed };
}

async function loadPromptDirectory(
  directory: string,
  expectedRole: AgentRole,
): Promise<PromptFile[]> {
  const absoluteDir = join(repoRoot, "prompts", directory);
  let entries: string[];
  try {
    entries = (await readdir(absoluteDir)).filter((name) => name.endsWith(".yaml"));
  } catch (cause) {
    throw new TribunalError(`cannot be read (${(cause as Error).message})`, rel(absoluteDir));
  }
  entries.sort(); // fixed, reproducible order across runs

  const prompts: PromptFile[] = [];
  for (const name of entries) {
    const absolute = join(absoluteDir, name);
    const where = rel(absolute);
    const { data } = await readYaml(absolute);
    const role = str(data, "role", where);
    if (role !== expectedRole) {
      throw new TribunalError(`declares role [${role}] but sits in prompts/${directory}/`, where);
    }
    prompts.push({
      path: where,
      schema_version: num(data, "schema_version", where),
      id: str(data, "id", where),
      version: str(data, "version", where),
      display_name: str(data, "display_name", where),
      role: expectedRole,
      seat: optionalStr(data, "seat", where),
      method_signal: optionalStr(data, "method_signal", where),
      disclaimer: optionalStr(data, "disclaimer", where),
      system_prompt: str(data, "system_prompt", where),
      output_contract: readContract(data, where),
    });
  }
  return prompts;
}

export async function loadPrompts(): Promise<{ advocates: PromptFile[]; judges: PromptFile[] }> {
  const [advocates, judges] = await Promise.all([
    loadPromptDirectory("advocates", "advocate"),
    loadPromptDirectory("judges", "judge"),
  ]);

  if (advocates.length !== EXPECTED_ADVOCATES) {
    throw new TribunalError(
      `expected ${EXPECTED_ADVOCATES} advocate prompts, found ${advocates.length}`,
      "prompts/advocates",
    );
  }
  if (judges.length !== EXPECTED_JUDGES) {
    throw new TribunalError(
      `expected ${EXPECTED_JUDGES} judge prompts, found ${judges.length}`,
      "prompts/judges",
    );
  }

  const seen = new Map<string, string>();
  for (const prompt of [...advocates, ...judges]) {
    const previous = seen.get(prompt.id);
    if (previous !== undefined) {
      throw new TribunalError(`agent id [${prompt.id}] is also used by ${previous}`, prompt.path);
    }
    seen.set(prompt.id, prompt.path);
  }
  return { advocates, judges };
}

// --- the run configuration -------------------------------------------------

const CONFIG_ALIASES: Record<string, string> = {
  single: "config/run-single.yaml",
  multi: "config/run-multi.yaml",
};

export function resolveConfigPath(argument: string): string {
  const alias = CONFIG_ALIASES[argument];
  return join(repoRoot, alias ?? argument);
}

export async function loadRunConfig(argument: string, agentIds: string[]): Promise<RunConfig> {
  const absolute = resolveConfigPath(argument);
  const where = rel(absolute);
  const { data } = await readYaml(absolute);

  const defaultModel = str(data, "default_model", where);
  const agents = record(data, "agents", where);
  const models: Record<string, string> = {};

  for (const id of agentIds) {
    const entry = agents[id];
    if (entry === undefined) {
      throw new TribunalError(`has no entry for agent [${id}]`, where);
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TribunalError(`agents.${id} must be a mapping`, where);
    }
    const model = str(entry as Record<string, unknown>, "model", `${where} agents.${id}`);
    models[id] = model === "default" ? defaultModel : model;
  }

  // A seat named in the config with no prompt file would be a silent no-op.
  for (const id of Object.keys(agents)) {
    if (!agentIds.includes(id)) {
      throw new TribunalError(`names agent [${id}], which has no prompt file`, where);
    }
  }

  const budget = data["budget"];
  let maxUsd: number | null = null;
  if (budget !== undefined && budget !== null) {
    if (typeof budget !== "object" || Array.isArray(budget)) {
      throw new TribunalError("field [budget] must be a mapping", where);
    }
    maxUsd = num(budget as Record<string, unknown>, "max_usd_per_run", `${where} budget`);
  }

  return {
    path: where,
    schema_version: num(data, "schema_version", where),
    mode: str(data, "mode", where),
    label: str(data, "label", where),
    default_model: defaultModel,
    models,
    max_usd_per_run: maxUsd,
  };
}

// --- everything at once ----------------------------------------------------

export async function loadRunInputs(configArgument: string): Promise<RunInputs> {
  const [chargeSheet, shared, prompts] = await Promise.all([
    loadChargeSheet(),
    loadSharedRules(),
    loadPrompts(),
  ]);
  const agentIds = [...prompts.advocates, ...prompts.judges].map((prompt) => prompt.id);
  const config = await loadRunConfig(configArgument, agentIds);
  return { chargeSheet, shared, advocates: prompts.advocates, judges: prompts.judges, config };
}
