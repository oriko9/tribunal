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
