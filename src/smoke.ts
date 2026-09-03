// The cheapest verification gate in the project.
//
// It calls no model and costs nothing, so it can be run before every run and
// before every commit. It checks the properties the protocol depends on:
//
//   - every input file on disk loads and validates
//   - both run configurations cover exactly the seven prompts that exist
//   - the prompt contracts and the charge sheet specification agree
//   - the assembled messages carry the shared rules and the verbatim spec
//   - advocates are not shown other advocates, judges not shown other judges
//
// It exits non-zero on the first failing property, so it can gate a run.
// Extend it as the pipeline grows; a property checked here is a property the
// repository can prove.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProviderError, TribunalError } from "./errors.js";
import { loadRunInputs, repoRoot } from "./load.js";
import { buildAdvocateMessages, buildJudgeMessages } from "./messages.js";
import type { AdvocateSubmission } from "./messages.js";
import { deliberate } from "./orchestrator.js";
import { FAULT_ENV_VAR, FAULT_KINDS, parseFaultSpec } from "./providers/faults.js";
import { renderProtocol } from "./protocol.js";
import { buildRunFile } from "./runfile.js";
import { API_KEY_ENV_VAR, MockProvider, PROVIDER_ENV_VAR, UNSET_MODEL, selectProvider } from "./providers/index.js";
import type { PromptFile, RunInputs } from "./types.js";

let passed = 0;
let failed = 0;

function must(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function check(name: string, assertion: () => void): void {
  try {
    assertion();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (cause) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(cause as Error).message}`);
  }
}

async function checkAsync(name: string, assertion: () => Promise<void>): Promise<void> {
  try {
    await assertion();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (cause) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(cause as Error).message}`);
  }
}

/** Asserts that a call fails, and that it fails for the stated reason. */
function refuses(action: () => unknown, expected: string): void {
  let message: string | null = null;
  try {
    action();
  } catch (cause) {
    message = (cause as Error).message;
  }
  must(message !== null, `expected a refusal mentioning [${expected}], but the call succeeded`);
  must(
    message.includes(expected),
    `expected a refusal mentioning [${expected}], got: ${message}`,
  );
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** A short, distinctive slice of a prompt, enough to prove it did or did not travel. */
function fingerprint(prompt: PromptFile): string {
  return prompt.system_prompt.trim().slice(0, 120);
}

function checkInputs(inputs: RunInputs): void {
  const { chargeSheet, shared, advocates, judges, config } = inputs;

  section(`Specification — ${chargeSheet.path}`);
  check("charge sheet declares a spec_version", () => {
    must(chargeSheet.spec_version.length > 0, "spec_version is empty");
  });
  check("agreed facts exist and carry unique identifiers", () => {
    must(chargeSheet.agreed_fact_ids.length > 0, "no agreed facts");
    must(
      new Set(chargeSheet.agreed_fact_ids).size === chargeSheet.agreed_fact_ids.length,
      "duplicate fact identifiers",
    );
  });
  check("the permitted verdicts are enumerated", () => {
    must(chargeSheet.permitted_verdicts.length >= 2, "fewer than two permitted verdicts");
  });

  section(`Shared rules — ${shared.path} v${shared.version}`);
  check("at least one rule binds every agent", () => {
    must(Object.keys(shared.rules).length > 0, "no shared rules");
  });

  section(`Prompts — ${advocates.length} advocates, ${judges.length} judges`);
  check("four advocates and three judges are on disk", () => {
    must(advocates.length === 4, `expected 4 advocates, found ${advocates.length}`);
    must(judges.length === 3, `expected 3 judges, found ${judges.length}`);
  });
  check("every prompt is versioned", () => {
    for (const prompt of [...advocates, ...judges]) {
      must(prompt.version.length > 0, `${prompt.path} has no version`);
    }
  });
  check("every advocate holds a procedural seat", () => {
    for (const prompt of advocates) {
      must(prompt.seat !== null, `${prompt.path} declares no seat`);
    }
  });
  check("every judge carries its standing disclaimer", () => {
    for (const prompt of judges) {
      must(prompt.disclaimer !== null, `${prompt.path} carries no disclaimer`);
    }
  });

  section("Output contracts");
  check("every contract gives the agent a field in which to declare failure", () => {
    // The shared failure rule tells an agent to declare failure in a designated
    // field. If the contract has no such field, that rule cannot be obeyed.
    for (const prompt of [...advocates, ...judges]) {
      must("refusal" in prompt.output_contract.fields, `${prompt.path} has no refusal field`);
    }
  });
  check("every advocate contract asks for a stance and the facts relied on", () => {
    for (const prompt of advocates) {
      must("stance" in prompt.output_contract.fields, `${prompt.path} has no stance field`);
      must(
        "facts_relied_on" in prompt.output_contract.fields,
        `${prompt.path} has no facts_relied_on field`,
      );
    }
  });
  check("every judge contract asks for a verdict and a protocol", () => {
    for (const prompt of judges) {
      must("verdict" in prompt.output_contract.fields, `${prompt.path} has no verdict field`);
      must(
        "protocol_steps" in prompt.output_contract.fields,
        `${prompt.path} has no protocol_steps field`,
      );
      must(
        "factors_addressed" in prompt.output_contract.fields,
        `${prompt.path} has no factors_addressed field`,
      );
    }
  });
  check("judge verdicts are drawn from the verdicts the specification permits", () => {
    // Guards the seam between two files: if the charge sheet changes the
    // permitted verdicts, the judge prompts must be revised with it.
    for (const prompt of judges) {
      const declared = prompt.output_contract.fields["verdict"] ?? "";
      for (const verdict of chargeSheet.permitted_verdicts) {
        must(
          declared.includes(verdict),
          `${prompt.path} does not offer the permitted verdict [${verdict}]`,
        );
      }
    }
  });

  section(`Run configuration — ${config.path} (${config.mode})`);
  check("every agent on disk is assigned a model", () => {
    for (const prompt of [...advocates, ...judges]) {
      const model = config.models[prompt.id];
      must(model !== undefined && model.length > 0, `${prompt.id} has no model`);
    }
  });
  check("no seat is left resolving to the literal word default", () => {
    for (const [id, model] of Object.entries(config.models)) {
      must(model !== "default", `${id} resolved to the string "default"`);
    }
  });
}

function checkMessages(inputs: RunInputs): void {
  const { chargeSheet, shared, advocates, judges } = inputs;

  section("Assembled advocate messages");
  const advocateMessages = advocates.map((prompt) => ({
    prompt,
    messages: buildAdvocateMessages(shared, prompt, chargeSheet),
  }));

  check("each advocate receives every shared rule", () => {
    for (const { prompt, messages } of advocateMessages) {
      for (const [name, text] of Object.entries(shared.rules)) {
        must(messages.system.includes(text.trim()), `${prompt.id} is missing rule [${name}]`);
      }
    }
  });
  check("each advocate receives its own seat prompt", () => {
    for (const { prompt, messages } of advocateMessages) {
      must(messages.system.includes(fingerprint(prompt)), `${prompt.id} is missing its own prompt`);
    }
  });
  check("each advocate receives the charge sheet verbatim", () => {
    for (const { prompt, messages } of advocateMessages) {
      must(
        messages.user.includes(chargeSheet.source.trimEnd()),
        `${prompt.id} did not receive the specification verbatim`,
      );
    }
  });
  check("no advocate receives another advocate's prompt", () => {
    for (const { prompt, messages } of advocateMessages) {
      const whole = `${messages.system}\n${messages.user}`;
      for (const other of advocates) {
        if (other.id === prompt.id) continue;
        must(
          !whole.includes(fingerprint(other)),
          `${prompt.id} was shown the prompt of ${other.id}`,
        );
      }
    }
  });

  section("Assembled judge messages");
  // Distinct texts, so a submission delivered to the wrong seat would show.
  const submissions: AdvocateSubmission[] = advocates.map((prompt) => ({
    prompt,
    raw_text: `{"speaker":"${prompt.display_name}","marker":"submission-of-${prompt.id}"}`,
  }));
  const judgeMessages = judges.map((prompt) => ({
    prompt,
    messages: buildJudgeMessages(shared, prompt, chargeSheet, submissions),
  }));

  check("each judge receives every shared rule", () => {
    for (const { prompt, messages } of judgeMessages) {
      for (const [name, text] of Object.entries(shared.rules)) {
        must(messages.system.includes(text.trim()), `${prompt.id} is missing rule [${name}]`);
      }
    }
  });
  check("each judge receives the charge sheet verbatim", () => {
    for (const { prompt, messages } of judgeMessages) {
      must(
        messages.user.includes(chargeSheet.source.trimEnd()),
        `${prompt.id} did not receive the specification verbatim`,
      );
    }
  });
  check("each judge receives all four advocate submissions, unaltered", () => {
    for (const { prompt, messages } of judgeMessages) {
      for (const submission of submissions) {
        must(
          messages.user.includes(submission.raw_text),
          `${prompt.id} is missing the submission of ${submission.prompt.id}`,
        );
      }
    }
  });
  check("no judge receives another judge's prompt or name", () => {
    for (const { prompt, messages } of judgeMessages) {
      const whole = `${messages.system}\n${messages.user}`;
      for (const other of judges) {
        if (other.id === prompt.id) continue;
        must(!whole.includes(fingerprint(other)), `${prompt.id} was shown the prompt of ${other.id}`);
        must(
          !whole.includes(other.display_name),
          `${prompt.id} was shown the name of ${other.id}`,
        );
      }
    }
  });
}

function agentIdsOf(inputs: RunInputs): string[] {
  return [...inputs.advocates, ...inputs.judges].map((prompt) => prompt.id);
}

/** Runs one seat against the mock, optionally with a fault injected into it. */
async function runMock(inputs: RunInputs, prompt: PromptFile, faultSpec = ""): Promise<string> {
  const faults = faultSpec === "" ? new Map() : parseFaultSpec(faultSpec, agentIdsOf(inputs));
  const provider = new MockProvider(faults);
  const submissions: AdvocateSubmission[] = inputs.advocates.map((advocate) => ({
    prompt: advocate,
    raw_text: `{"speaker":"${advocate.display_name}"}`,
  }));
  const messages =
    prompt.role === "advocate"
      ? buildAdvocateMessages(inputs.shared, prompt, inputs.chargeSheet)
      : buildJudgeMessages(inputs.shared, prompt, inputs.chargeSheet, submissions);

  const reply = await provider.complete({
    agentId: prompt.id,
    model: "mock-model",
    system: messages.system,
    user: messages.user,
    prompt,
    chargeSheet: inputs.chargeSheet,
  });
  return reply.raw_text;
}

async function checkProviders(inputs: RunInputs): Promise<void> {
  const agentIds = agentIdsOf(inputs);
  const models = inputs.config.models;
  const judge = inputs.judges[0];
  const advocate = inputs.advocates[0];
  must(judge !== undefined && advocate !== undefined, "no prompts to test the provider with");

  section("Provider selection");
  check("the mock is the default, so no run spends money by accident", () => {
    const selection = selectProvider({} as NodeJS.ProcessEnv, agentIds, models);
    must(selection.name === "mock", `default provider is ${selection.name}`);
  });
  check("an unknown provider name is refused", () => {
    refuses(
      () => selectProvider({ [PROVIDER_ENV_VAR]: "openai" } as NodeJS.ProcessEnv, agentIds, models),
      PROVIDER_ENV_VAR,
    );
  });
  check("a live run without a key is refused", () => {
    refuses(
      () =>
        selectProvider({ [PROVIDER_ENV_VAR]: "openrouter" } as NodeJS.ProcessEnv, agentIds, models),
      API_KEY_ENV_VAR,
    );
  });
  check("a live run against unset model ids is refused before any call is made", () => {
    refuses(
      () =>
        selectProvider(
          { [PROVIDER_ENV_VAR]: "openrouter", [API_KEY_ENV_VAR]: "not-a-real-key" } as NodeJS.ProcessEnv,
          agentIds,
          models,
        ),
      UNSET_MODEL,
    );
  });

  section("Mock replies follow the contracts on disk");
  for (const prompt of [...inputs.advocates, ...inputs.judges]) {
    await checkAsync(`${prompt.id} returns every field its contract requires`, async () => {
      const raw = await runMock(inputs, prompt);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const field of Object.keys(prompt.output_contract.fields)) {
        must(field in parsed, `field [${field}] is missing`);
      }
      const extra = Object.keys(parsed).filter(
        (field) => !(field in prompt.output_contract.fields),
      );
      must(extra.length === 0, `unexpected fields: ${extra.join(", ")}`);

      // Where a contract states a range or an enumeration, the reply honours
      // it. Without this the mock could satisfy the shape and nothing else.
      for (const [field, description] of Object.entries(prompt.output_contract.fields)) {
        const value = parsed[field];
        const range = /(\d+)\s*to\s*(\d+)\s*words/i.exec(description);
        if (range?.[1] !== undefined && range[2] !== undefined && typeof value === "string") {
          const count = value.trim().split(/\s+/).length;
          must(
            count >= Number(range[1]) && count <= Number(range[2]),
            `${field} has ${count} words, outside ${range[1]}-${range[2]}`,
          );
        }
        const oneOf = /one of:\s*(.+)/i.exec(description);
        if (oneOf?.[1] !== undefined && typeof value === "string") {
          const options = oneOf[1].split("|").map((option) => option.trim());
          must(options.includes(value), `${field} is [${value}], not one of ${options.join(", ")}`);
        }
      }
    });
  }

  section(`Fault injection — ${FAULT_ENV_VAR}`);
  await checkAsync("invalid_json produces text that does not parse", async () => {
    const raw = await runMock(inputs, judge, `${judge.id}=invalid_json`);
    let parsed = true;
    try {
      JSON.parse(raw);
    } catch {
      parsed = false;
    }
    must(!parsed, "the injected fault still parsed as JSON");
  });
  await checkAsync("missing_field drops a field the contract requires", async () => {
    const raw = await runMock(inputs, judge, `${judge.id}=missing_field:verdict`);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    must(!("verdict" in parsed), "the verdict field survived");
    must("opinion" in parsed, "the fault removed more than the named field");
  });
  await checkAsync("illegal_verdict returns a verdict the charge sheet does not permit", async () => {
    const raw = await runMock(inputs, judge, `${judge.id}=illegal_verdict`);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const verdict = parsed["verdict"];
    must(typeof verdict === "string", "no verdict was returned");
    must(
      !inputs.chargeSheet.permitted_verdicts.includes(verdict),
      `verdict [${verdict}] is in fact permitted, so it is not a fault`,
    );
  });
  await checkAsync("empty returns nothing at all", async () => {
    const raw = await runMock(inputs, advocate, `${advocate.id}=empty`);
    must(raw === "", `expected an empty reply, got ${raw.length} characters`);
  });
  await checkAsync("fenced_json returns JSON the contract forbids fencing", async () => {
    const raw = await runMock(inputs, advocate, `${advocate.id}=fenced_json`);
    must(raw.startsWith("```"), "the reply was not fenced");
    let parsed = true;
    try {
      JSON.parse(raw);
    } catch {
      parsed = false;
    }
    must(!parsed, "a fenced reply must not parse strictly");
  });
  await checkAsync("declared_refusal fills the field the failure rule designates", async () => {
    const raw = await runMock(inputs, advocate, `${advocate.id}=declared_refusal`);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    must(typeof parsed["refusal"] === "string", "refusal was not declared");
  });
  await checkAsync("transport_error never returns at all", async () => {
    let thrown: unknown = null;
    try {
      await runMock(inputs, advocate, `${advocate.id}=transport_error`);
    } catch (cause) {
      thrown = cause;
    }
    must(thrown instanceof ProviderError, "a transport fault must throw a ProviderError");
  });
  check("every documented fault kind is exercised above", () => {
    // Guards against a fault kind being added without a check to go with it.
    const exercised = [
      "invalid_json",
      "missing_field",
      "illegal_verdict",
      "empty",
      "fenced_json",
      "declared_refusal",
      "transport_error",
    ];
    for (const kind of FAULT_KINDS) {
      must(exercised.includes(kind), `fault kind [${kind}] has no smoke check`);
    }
  });
  check("a fault spec naming an unknown agent or fault is refused", () => {
    refuses(() => parseFaultSpec("no_such_agent=empty", agentIds), "no_such_agent");
    refuses(() => parseFaultSpec(`${agentIds[0]}=no_such_fault`, agentIds), "no_such_fault");
  });
}

async function checkDeliberation(inputs: RunInputs): Promise<void> {
  section("The protocol, end to end against the mock");

  const clean = new MockProvider();
  const report = await deliberate(inputs, clean);
  const runFile = buildRunFile(inputs, clean, report);
  const protocol = renderProtocol(runFile, inputs);

  check("four advocates and three opinions are recorded", () => {
    must(runFile.advocates.length === 4, `${runFile.advocates.length} advocates recorded`);
    const opinions = Object.keys(runFile.opinions);
    must(opinions.length === 3, `${opinions.length} opinions recorded`);
    // Three named siblings, never a single combined object.
    for (const prompt of inputs.judges) {
      must(prompt.id in runFile.opinions, `no opinion recorded for ${prompt.id}`);
    }
  });

  check("every seat returned usable output", () => {
    for (const record of [...runFile.advocates, ...Object.values(runFile.opinions)]) {
      must(record.status === "ok", `${record.agent_id} is ${record.status}`);
    }
  });

  check("no agent's text was altered on the way into the record", () => {
    for (const record of [...runFile.advocates, ...Object.values(runFile.opinions)]) {
      must(record.raw_text !== null, `${record.agent_id} recorded no raw text`);
      must(
        JSON.stringify(JSON.parse(record.raw_text)) === JSON.stringify(record.output),
        `${record.agent_id}: the recorded output differs from the recorded raw text`,
      );
    }
  });

  check("the run totals are the sum of the per-call usage", () => {
    const rows = runFile.usage.calls;
    const totals = runFile.usage.totals;
    must(rows.length === 7, `${rows.length} usage rows for 7 seats`);
    const tokens = rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0);
    must(totals.total_tokens === tokens, `totals say ${totals.total_tokens}, rows say ${tokens}`);
    const cost = rows.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
    must(Math.abs(totals.cost_usd - cost) < 1e-8, `totals say ${totals.cost_usd}, rows say ${cost}`);
  });

  check("the protocol prints all seven seats and combines nothing", () => {
    for (const prompt of [...inputs.advocates, ...inputs.judges]) {
      must(protocol.includes(prompt.display_name), `${prompt.display_name} is missing from the protocol`);
    }
    for (const prompt of inputs.judges) {
      const headings = protocol.split("\n").filter((line) => line === `### ${prompt.display_name}`);
      must(headings.length === 1, `${prompt.id} has ${headings.length} sections, expected exactly 1`);
    }
    must(protocol.includes("**not combined**"), "the protocol does not state that it combines nothing");
    // Each opinion carries its own verdict; there is no run-level verdict.
    for (const record of Object.values(runFile.opinions)) {
      const verdict = (record.output as Record<string, unknown>)["verdict"];
      must(
        protocol.includes(`**Verdict:** \`${String(verdict)}\``),
        `the verdict of ${record.agent_id} is not printed in its own section`,
      );
    }
  });

  section("The protocol when a seat fails");
  const judgeId = inputs.judges[1]?.id;
  must(judgeId !== undefined, "no second judge to fail");
  const faulty = new MockProvider(parseFaultSpec(`${judgeId}=missing_field:verdict`, agentIdsOf(inputs)));
  const faultyReport = await deliberate(inputs, faulty);
  const faultyRun = buildRunFile(inputs, faulty, faultyReport);
  const faultyProtocol = renderProtocol(faultyRun, inputs);

  check("a failed seat is recorded as a failure, not as a result", () => {
    const record = faultyRun.opinions[judgeId];
    must(record !== undefined, `${judgeId} is missing from the record entirely`);
    must(record.status === "failed", `${judgeId} is ${record.status}`);
    must(record.failure?.kind === "contract_mismatch", `unexpected failure kind ${record.failure?.kind}`);
    must(faultyRun.run.status === "incomplete", "the run still calls itself complete");
  });

  check("a failed seat keeps its section instead of being dropped", () => {
    const name = inputs.judges[1]?.display_name ?? "";
    must(faultyProtocol.includes(`### ${name}`), `${name} was omitted from the protocol`);
    must(
      faultyProtocol.includes("This seat produced no usable output."),
      "the protocol does not say plainly that the seat failed",
    );
    must(
      !faultyProtocol.includes(`**Verdict:** \`undefined\``),
      "the protocol invented a verdict for a seat that returned none",
    );
    // The other two opinions are untouched by their sibling's failure.
    for (const other of Object.values(faultyRun.opinions)) {
      if (other.agent_id === judgeId) continue;
      must(other.status === "ok", `${other.agent_id} was affected by another seat's failure`);
    }
  });

  section("The protocol when an advocate fails");
  const advocateId = inputs.advocates[2]?.id;
  must(advocateId !== undefined, "no third advocate to fail");
  const brokenAdvocate = new MockProvider(
    parseFaultSpec(`${advocateId}=transport_error`, agentIdsOf(inputs)),
  );
  const brokenReport = await deliberate(inputs, brokenAdvocate);
  const brokenRun = buildRunFile(inputs, brokenAdvocate, brokenReport);

  check("the judges do not sit on an incomplete set of arguments", () => {
    const failed = brokenRun.advocates.find((record) => record.agent_id === advocateId);
    must(failed?.status === "failed", `${advocateId} is ${failed?.status}`);
    must(failed?.failure?.kind === "transport", `unexpected failure kind ${failed?.failure?.kind}`);
    for (const record of Object.values(brokenRun.opinions)) {
      must(record.status === "not_run", `${record.agent_id} sat anyway (${record.status})`);
      must(record.output === null, `${record.agent_id} produced an opinion without four arguments`);
    }
  });
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-or-v1-[A-Za-z0-9]{8,}/,
  /sk-[A-Za-z0-9]{32,}/,
];

const ENV_TEMPLATE = ".env.local.example";
const ENV_FILE = ".env.local";

/** A real environment file, as opposed to the committed template. */
function isSecretBearing(name: string): boolean {
  return /^\.env(\..+)?$/.test(name) && !name.endsWith(".example");
}

async function checkSecrets(): Promise<void> {
  section("Secret hygiene");

  await checkAsync("every environment file is ignored by git", async () => {
    const ignored = (await readFile(join(repoRoot, ".gitignore"), "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim());
    for (const name of [".env", ENV_FILE]) {
      must(ignored.includes(name), `${name} is not listed in .gitignore`);
    }
  });

  await checkAsync(`${ENV_TEMPLATE} is committed and carries no real values`, async () => {
    const template = await readFile(join(repoRoot, ENV_TEMPLATE), "utf8");
    for (const name of [
      "OPENROUTER_API_KEY",
      "TRIBUNAL_PROVIDER",
      "TRIBUNAL_MOCK_FAULTS",
      "TRIBUNAL_TIMEOUT_MS",
    ]) {
      must(template.includes(`${name}=`), `${ENV_TEMPLATE} does not document ${name}`);
    }
    const keyLine = template
      .split(/\r?\n/)
      .find((line) => line.startsWith("OPENROUTER_API_KEY="));
    must(keyLine === "OPENROUTER_API_KEY=", `${ENV_TEMPLATE} ships a value for the key`);
  });

  await checkAsync(`the npm scripts load ${ENV_FILE}`, async () => {
    // Without this flag the key could sit in the file and never reach the code.
    const manifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    for (const name of ["tribunal", "smoke"]) {
      const script = manifest.scripts?.[name];
      must(script !== undefined, `there is no ${name} script`);
      must(
        script.includes(`--env-file-if-exists=${ENV_FILE}`),
        `the ${name} script does not load ${ENV_FILE}`,
      );
    }
  });

  await checkAsync("no committed file contains an API key", async () => {
    const skip = new Set(["node_modules", ".git", "dist", ".vercel"]);
    const offenders: string[] = [];
    const entries = await readdir(repoRoot, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const parts = entry.parentPath.split(/[\\/]/);
      if (parts.some((part) => skip.has(part))) continue;
      // .env.local is where a key belongs. It is git-ignored, and it is checked
      // for that above rather than for its contents here.
      if (isSecretBearing(entry.name)) continue;
      const path = join(entry.parentPath, entry.name);
      // The gate names the patterns it looks for, so reading itself would
      // always trip it.
      if (path.endsWith("smoke.ts")) continue;
      let content: string;
      try {
        content = await readFile(path, "utf8");
      } catch {
        continue;
      }
      if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
        offenders.push(path);
      }
    }
    must(offenders.length === 0, `possible key material in: ${offenders.join(", ")}`);
  });
}

async function main(): Promise<void> {
  console.log("Tribunal smoke checks — no model is called, nothing is spent.");

  let single: RunInputs;
  let multi: RunInputs;
  try {
    single = await loadRunInputs("single");
    multi = await loadRunInputs("multi");
  } catch (cause) {
    console.error(`\nFAIL  inputs could not be loaded\n      ${(cause as Error).message}`);
    process.exit(1);
  }

  checkInputs(single);
  checkMessages(single);
  await checkProviders(single);
  await checkDeliberation(single);
  await checkSecrets();

  // Mode B must stay loadable and complete even while it is not the mode in
  // use; the progression from one model to several is a graded requirement.
  section(`Run configuration — ${multi.config.path} (${multi.config.mode})`);
  check("the multi-model configuration covers every agent", () => {
    for (const prompt of [...multi.advocates, ...multi.judges]) {
      const model = multi.config.models[prompt.id];
      must(model !== undefined && model.length > 0, `${prompt.id} has no model`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("Smoke checks failed. Do not run the Tribunal on this tree.");
    process.exit(1);
  }
}

await main();
