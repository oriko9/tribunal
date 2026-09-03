// Chooses the provider for a run and refuses to start a run that cannot work.
//
// The default is the mock. Spending money has to be asked for explicitly:
// TRIBUNAL_PROVIDER=openrouter. Whichever is chosen, the run file and the
// console both name it, so no output can be mistaken for the other kind.

import { TribunalError } from "../errors.js";
import { faultsFromEnv } from "./faults.js";
import { MockProvider } from "./mock.js";
import { API_KEY_ENV_VAR, OpenRouterProvider, UNSET_MODEL } from "./openrouter.js";
import type { ModelProvider } from "./types.js";

export const PROVIDER_ENV_VAR = "TRIBUNAL_PROVIDER";
export const PROVIDER_NAMES = ["mock", "openrouter"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface ProviderSelection {
  provider: ModelProvider;
  name: ProviderName;
}

/**
 * @param agentIds every seat that will speak, used to reject a fault spec that
 *   names an agent which does not exist.
 * @param models the model id each seat resolved to, checked before the run so
 *   an unset placeholder fails at startup rather than seven calls in.
 */
/**
 * A variable present but empty is a variable not set. The committed template
 * ships every name with an empty value, so this is the normal case, not an
 * edge one.
 */
function value(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function selectProvider(
  env: NodeJS.ProcessEnv,
  agentIds: readonly string[],
  models: Readonly<Record<string, string>>,
): ProviderSelection {
  const requested = value(env, PROVIDER_ENV_VAR) ?? "mock";

  if (!PROVIDER_NAMES.includes(requested as ProviderName)) {
    throw new TribunalError(
      `is [${requested}], which is not one of: ${PROVIDER_NAMES.join(", ")}`,
      PROVIDER_ENV_VAR,
    );
  }
  const name = requested as ProviderName;

  if (name === "mock") {
    return { provider: new MockProvider(faultsFromEnv(env, agentIds)), name };
  }

  const apiKey = value(env, API_KEY_ENV_VAR);
  if (apiKey === undefined) {
    throw new TribunalError(
      `is not set, and ${PROVIDER_ENV_VAR}=openrouter was requested. ` +
        `Put the key in .env.local, which is git-ignored and loaded automatically ` +
        `(copy .env.local.example to start). It must never be written into a committed file.`,
      API_KEY_ENV_VAR,
    );
  }

  const unset = Object.entries(models)
    .filter(([, model]) => model.trim() === "" || model === UNSET_MODEL)
    .map(([agentId]) => agentId);
  if (unset.length > 0) {
    throw new TribunalError(
      `cannot run live: the run configuration still leaves ${unset.join(", ")} at ${UNSET_MODEL}`,
      PROVIDER_ENV_VAR,
    );
  }

  const timeout = value(env, "TRIBUNAL_TIMEOUT_MS");
  const timeoutMs = timeout === undefined ? undefined : Number(timeout);
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new TribunalError(`is [${timeout}], which is not a positive number`, "TRIBUNAL_TIMEOUT_MS");
  }

  return { provider: new OpenRouterProvider(apiKey, timeoutMs), name };
}

export { MockProvider } from "./mock.js";
export { OpenRouterProvider, API_KEY_ENV_VAR, UNSET_MODEL } from "./openrouter.js";
export type { ModelProvider, ModelReply, ModelRequest } from "./types.js";
