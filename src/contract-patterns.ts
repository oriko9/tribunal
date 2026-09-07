// Shared parsing of the small, informal pattern language used in
// output_contract field descriptions (see prompts/*.yaml, e.g. "200 to 320
// words", "one of: justified | not_justified", "keys Q1, Q2, Q3, Q4, each a
// one-sentence answer").
//
// src/providers/mock.ts uses these to generate synthetic output that
// satisfies a contract; src/gates.ts uses the same patterns to verify that
// real output actually does. Keeping the parsing in one place means the
// generator and the validator cannot silently drift apart — a pattern fixed
// or extended here is fixed in both places at once.

export function parseWordRange(description: string): [number, number] | null {
  const match = /(\d+)\s*to\s*(\d+)\s*words/i.exec(description);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return [Number(match[1]), Number(match[2])];
}

export function parseObjectCountRange(description: string): [number, number] | null {
  const match = /(\d+)\s*to\s*(\d+)\s*objects/i.exec(description);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return [Number(match[1]), Number(match[2])];
}

export function parseEnum(description: string): string[] | null {
  const match = /one of:\s*(.+)/i.exec(description);
  if (match?.[1] === undefined) return null;
  const options = match[1]
    .split("|")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
  return options.length > 0 ? options : null;
}

/** "object with keys Q1, Q2, Q3, Q4, each ..." -> ["Q1","Q2","Q3","Q4"]. */
export function parseKeyedObjectFields(description: string): string[] | null {
  const match = /keys\s+(.+?),\s*each/i.exec(description);
  if (match?.[1] === undefined) return null;
  const keys = match[1]
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  return keys.length > 0 ? keys : null;
}
