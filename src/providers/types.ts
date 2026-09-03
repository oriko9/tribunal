// The seam between the protocol and whatever produces the text.
//
// The orchestrator knows only this interface. Swapping the mock for a live
// OpenRouter account changes one environment variable and no protocol code.

import type { ChargeSheet, PromptFile, Usage } from "../types.js";

export interface ModelRequest {
  /** Which seat is speaking. Carried for tracing and for fault selection. */
  agentId: string;
  /** The model id this seat resolved to in the run configuration. */
  model: string;
  system: string;
  user: string;
  /**
   * The seat's prompt file and the case specification. The live client needs
   * neither — it sends only the two messages. The mock reads the output
   * contract from the prompt so its replies match the shape the agent was
   * actually asked for, rather than a shape hardcoded here.
   */
  prompt: PromptFile;
  chargeSheet: ChargeSheet;
}

export interface ModelReply {
  /** Exactly what came back. Never trimmed, repaired or reformatted. */
  raw_text: string;
  usage: Usage;
  /** The provider's own id for the call, when it gives one. */
  provider_call_id: string | null;
}

export interface ModelProvider {
  readonly name: string;
  /** Whether the costs it reports are real money or invented for the mock. */
  readonly pricing: Usage["pricing"];
  /** A line the run file and the operator both see, naming what actually ran. */
  describe(): string;
  complete(request: ModelRequest): Promise<ModelReply>;
}
