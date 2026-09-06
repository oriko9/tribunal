// Model discovery, run once, as evidence rather than a terminal scrollback.
//
// Queries OpenRouter's public model catalogue, keeps only entries priced at
// zero for both prompt and completion tokens, and writes what it found to
// docs/free-models.md. The choice of model for a live run should be traceable
// to this file, not to a choice made and forgotten in a terminal.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TribunalError } from "./errors.js";
import { repoRoot } from "./load.js";
import { API_KEY_ENV_VAR } from "./providers/openrouter.js";

const ENDPOINT = "https://openrouter.ai/api/v1/models";
const MIN_CONTEXT_LENGTH = 32_000;
/** Everything from this heading onward is hand-maintained and survives regeneration. */
const MANUAL_SECTION_HEADING = "## Live attempts against mode A";

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; request?: string; image?: string };
  top_provider?: { context_length?: number; max_completion_tokens?: number };
  per_request_limits?: unknown;
}

interface FreeModel {
  id: string;
  name: string;
  context_length: number;
  max_completion_tokens: number | null;
  per_request_limits: string;
}

function isZero(value: string | undefined): boolean {
  if (value === undefined) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed === 0;
}

async function fetchCatalogue(apiKey: string): Promise<OpenRouterModel[]> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (cause) {
    throw new TribunalError(`request to ${ENDPOINT} failed: ${(cause as Error).message}`);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new TribunalError(
      `${ENDPOINT} returned HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new TribunalError(`${ENDPOINT} returned a body that is not JSON: ${bodyText.slice(0, 200)}`);
  }

  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new TribunalError(`${ENDPOINT} returned no model list (no "data" array)`);
  }
  return data as OpenRouterModel[];
}

function selectFree(models: readonly OpenRouterModel[]): {
  free: FreeModel[];
  rejectedForContext: FreeModel[];
} {
  const free: FreeModel[] = [];
  const rejectedForContext: FreeModel[] = [];

  for (const model of models) {
    if (!isZero(model.pricing?.prompt) || !isZero(model.pricing?.completion)) continue;

    const contextLength = model.top_provider?.context_length ?? model.context_length ?? 0;
    const entry: FreeModel = {
      id: model.id,
      name: model.name ?? model.id,
      context_length: contextLength,
      max_completion_tokens: model.top_provider?.max_completion_tokens ?? null,
      per_request_limits:
        model.per_request_limits === null || model.per_request_limits === undefined
          ? "none reported"
          : JSON.stringify(model.per_request_limits),
    };

    if (contextLength < MIN_CONTEXT_LENGTH) {
      rejectedForContext.push(entry);
      continue;
    }
    free.push(entry);
  }

  free.sort((a, b) => b.context_length - a.context_length);
  rejectedForContext.sort((a, b) => b.context_length - a.context_length);
  return { free, rejectedForContext };
}

function renderTable(models: readonly FreeModel[]): string {
  if (models.length === 0) return "_none found_\n";
  const header = "| Model id | Context length | Max completion tokens | Per-request limits |";
  const divider = "|---|---|---|---|";
  const rows = models.map(
    (model) =>
      `| \`${model.id}\` | ${model.context_length.toLocaleString()} | ${model.max_completion_tokens?.toLocaleString() ?? "not reported"} | ${model.per_request_limits} |`,
  );
  return [header, divider, ...rows].join("\n");
}

function renderReport(
  free: readonly FreeModel[],
  rejectedForContext: readonly FreeModel[],
  totalScanned: number,
): string {
  const generatedAt = new Date().toISOString();
  return [
    "# Free models on OpenRouter",
    "",
    `Generated ${generatedAt} by \`npm run models\`, querying ${ENDPOINT}.`,
    `${totalScanned} models scanned; a model is free here when both its prompt and`,
    "completion pricing are exactly 0, as reported by the endpoint at the time this",
    "file was generated. OpenRouter's free tier changes over time — this is a",
    "snapshot, not a standing guarantee. Re-run `npm run models` before relying on it.",
    "",
    `Models with a reported context length under ${MIN_CONTEXT_LENGTH.toLocaleString()} tokens are`,
    "excluded from the table below: a judge's prompt already carries the charge",
    "sheet and all four advocate arguments, close to 4,000 tokens before the model",
    "writes a word, and that grows as the arguments do.",
    "",
    "## Free models, sorted by context length (descending)",
    "",
    renderTable(free),
    "",
    `## Free but rejected for context length under ${MIN_CONTEXT_LENGTH.toLocaleString()}`,
    "",
    renderTable(rejectedForContext),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const apiKey = process.env[API_KEY_ENV_VAR];
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new TribunalError(
      `is not set. Put it in .env.local (git-ignored) to query the OpenRouter catalogue.`,
      API_KEY_ENV_VAR,
    );
  }

  console.log(`Querying ${ENDPOINT} ...`);
  const models = await fetchCatalogue(apiKey);
  console.log(`${models.length} models returned.`);

  const { free, rejectedForContext } = selectFree(models);
  console.log(
    `${free.length} free models with context length >= ${MIN_CONTEXT_LENGTH.toLocaleString()}, ` +
      `${rejectedForContext.length} free but below that threshold.`,
  );
  console.log("");
  console.log(renderTable(free));

  const outPath = join(repoRoot, "docs", "free-models.md");

  // The report above this line is generated fresh every run. Below the manual
  // heading, an operator records what actually happened when a model was put
  // in a run config and run — that history must survive regeneration, not be
  // silently overwritten by the next `npm run models`.
  let manualSection = "";
  try {
    const existing = await readFile(outPath, "utf8");
    const at = existing.indexOf(MANUAL_SECTION_HEADING);
    if (at !== -1) manualSection = existing.slice(at);
  } catch {
    // No prior file: nothing to preserve.
  }

  const report = renderReport(free, rejectedForContext, models.length);
  const withManualSection = manualSection === "" ? report : `${report}\n${manualSection}`;
  await writeFile(outPath, withManualSection, "utf8");
  console.log(`\nWritten to ${outPath}`);

  if (free.length === 0) {
    console.error(
      "\nNo free model clears the context-length filter. Stop here and report back " +
        "rather than picking something that will not hold a judge's prompt.",
    );
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
