/**
 * A failure the operator must see. Thrown for anything that makes the run
 * invalid before it starts: a missing input file, a malformed specification, a
 * config that does not match the prompts on disk, a missing API key.
 *
 * Nothing here recovers from one of these by substituting a default.
 */
export class TribunalError extends Error {
  readonly where: string | undefined;

  constructor(message: string, where?: string) {
    super(where ? `${where}: ${message}` : message);
    this.name = "TribunalError";
    this.where = where;
  }
}

/**
 * One model call did not come back. Unlike a TribunalError this does not stop
 * the process: the orchestrator records it against that agent as a failure and
 * the run file shows a seat that produced nothing. It is never repaired and
 * never replaced with substitute content.
 */
export class ProviderError extends Error {
  constructor(message: string, readonly agentId: string) {
    super(message);
    this.name = "ProviderError";
  }
}
