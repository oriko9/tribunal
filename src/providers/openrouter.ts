// The live provider.
//
// The API key is read from the environment and is used in exactly one place:
// the Authorization header of this request. It is never written to a run file,
// never logged, never returned from a function, and never sent to the browser.
// The only code that touches it is this file, and this file runs on the server.

import { ProviderError, TribunalError } from "../errors.js";
import type { Usage } from "../types.js";
import type { ModelProvider, ModelReply, ModelRequest } from "./types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const API_KEY_ENV_VAR = "OPENROUTER_API_KEY";
const DEFAULT_TIMEOUT_MS = 120_000;

/** Placeholder left in the run configurations until the account exists. */
export const UNSET_MODEL = "MODEL_ID_TBD";

interface OpenRouterUsage {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  cost?: unknown;
}

function readTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export class OpenRouterProvider implements ModelProvider {
  readonly name = "openrouter";
  readonly pricing: Usage["pricing"] = "provider";

  readonly #apiKey: string;
  readonly #timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    if (apiKey.trim() === "") {
      throw new TribunalError(`is empty`, API_KEY_ENV_VAR);
    }
    this.#apiKey = apiKey;
    this.#timeoutMs = timeoutMs;
  }

  describe(): string {
    // The key itself is never part of this line, only the fact that one is set.
    return `openrouter — live calls, real cost, key from ${API_KEY_ENV_VAR}, timeout ${this.#timeoutMs}ms`;
  }

  async complete(request: ModelRequest): Promise<ModelReply> {
    if (request.model.trim() === "" || request.model === UNSET_MODEL) {
      throw new ProviderError(
        `no usable model id for this seat: the run configuration still says ${request.model}`,
        request.agentId,
      );
    }

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "The Tribunal",
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          // Asks OpenRouter to report what the call actually cost.
          usage: { include: true },
        }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (cause) {
      // No retry. A call that did not come back is recorded as a failed seat,
      // not quietly attempted again until it looks like it worked.
      throw new ProviderError(`request failed: ${(cause as Error).message}`, request.agentId);
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        `HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`,
        request.agentId,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      throw new ProviderError(
        `provider returned a body that is not JSON: ${bodyText.slice(0, 200)}`,
        request.agentId,
      );
    }

    const choices = body["choices"];
    const first = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
    const message = first?.["message"] as Record<string, unknown> | undefined;
    const content = message?.["content"];
    if (typeof content !== "string") {
      throw new ProviderError(
        `provider returned no message content: ${bodyText.slice(0, 200)}`,
        request.agentId,
      );
    }

    const usage = (body["usage"] ?? {}) as OpenRouterUsage;
    const prompt_tokens = readTokenCount(usage.prompt_tokens);
    const completion_tokens = readTokenCount(usage.completion_tokens);
    const reportedTotal = readTokenCount(usage.total_tokens);
    // Cost is reported or it is null. It is never estimated here: an invented
    // number in a cost report is worse than an absent one.
    const cost = typeof usage.cost === "number" && Number.isFinite(usage.cost) ? usage.cost : null;

    return {
      raw_text: content,
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: reportedTotal > 0 ? reportedTotal : prompt_tokens + completion_tokens,
        cost_usd: cost,
        pricing: cost === null ? "unavailable" : "provider",
      },
      provider_call_id: typeof body["id"] === "string" ? body["id"] : null,
    };
  }
}
