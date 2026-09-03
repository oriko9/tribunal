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

import { loadRunInputs } from "./load.js";
import { buildAdvocateMessages, buildJudgeMessages } from "./messages.js";
import type { AdvocateSubmission } from "./messages.js";
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
