// Assembles the two messages sent to one agent.
//
// The composition is fixed by the protocol:
//   advocate = shared rules + its own seat prompt + the charge sheet
//   judge    = shared rules + its own seat prompt + the charge sheet
//              + all four advocate arguments
//
// Two exclusions are structural rather than instructed: an advocate is never
// handed another advocate's output, and a judge is never handed another
// judge's. There is no code path that could pass them.

import type { ChargeSheet, PromptFile, SharedRules } from "./types.js";

export interface AgentMessages {
  system: string;
  user: string;
}

/** One advocate's reply, carried to the judges exactly as the model returned it. */
export interface AdvocateSubmission {
  prompt: PromptFile;
  raw_text: string;
}

function renderSharedRules(shared: SharedRules): string {
  const blocks = Object.entries(shared.rules).map(
    ([name, text]) => `## ${name}\n${text.trim()}`,
  );
  return [
    `RULES OF THE TRIBUNAL`,
    `These bind every agent. Source: ${shared.path}, version ${shared.version}.`,
    ``,
    blocks.join("\n\n"),
  ].join("\n");
}

function renderContract(prompt: PromptFile): string {
  const fields = Object.entries(prompt.output_contract.fields).map(
    ([name, description]) => `  "${name}": ${description}`,
  );
  return [
    `REQUIRED OUTPUT`,
    `Return one ${prompt.output_contract.format.toUpperCase()} object and nothing else:`,
    `no commentary before or after it, and no markdown code fence. Exactly these fields:`,
    ``,
    fields.join("\n"),
  ].join("\n");
}

export function buildSystemMessage(shared: SharedRules, prompt: PromptFile): string {
  const sections = [renderSharedRules(shared), ``, `YOUR SEAT`];

  sections.push(
    `Source: ${prompt.path}, version ${prompt.version}.` +
      (prompt.seat === null ? "" : ` You sit for the ${prompt.seat}.`),
  );
  sections.push(``, prompt.system_prompt.trim());

  if (prompt.disclaimer !== null) {
    sections.push(``, `STANDING DISCLAIMER`, prompt.disclaimer.trim());
  }

  sections.push(``, renderContract(prompt));
  return sections.join("\n");
}

function renderChargeSheet(chargeSheet: ChargeSheet): string {
  return [
    `CHARGE SHEET — ${chargeSheet.case_id}, ${chargeSheet.case_title}`,
    `Source: ${chargeSheet.path}, spec_version ${chargeSheet.spec_version}.`,
    `This specification is the entire record. It is reproduced here verbatim.`,
    ``,
    `-----BEGIN CHARGE SHEET-----`,
    chargeSheet.source.trimEnd(),
    `-----END CHARGE SHEET-----`,
  ].join("\n");
}

export function buildAdvocateMessages(
  shared: SharedRules,
  prompt: PromptFile,
  chargeSheet: ChargeSheet,
): AgentMessages {
  const user = [
    renderChargeSheet(chargeSheet),
    ``,
    `You are the only advocate addressing the Tribunal at this moment. You have`,
    `not seen, and will not see, what the other advocates say.`,
    ``,
    `Give your argument now, as the single JSON object your seat requires.`,
  ].join("\n");

  return { system: buildSystemMessage(shared, prompt), user };
}

export function buildJudgeMessages(
  shared: SharedRules,
  prompt: PromptFile,
  chargeSheet: ChargeSheet,
  submissions: readonly AdvocateSubmission[],
): AgentMessages {
  const arguments_ = submissions.map((submission) => {
    const seat = submission.prompt.seat === null ? "advocate" : submission.prompt.seat;
    return [
      `### ${submission.prompt.display_name} — ${seat}`,
      `Source: ${submission.prompt.path}, version ${submission.prompt.version}.`,
      ``,
      submission.raw_text.trim(),
    ].join("\n");
  });

  const user = [
    renderChargeSheet(chargeSheet),
    ``,
    `ARGUMENTS OF THE ADVOCATES`,
    `All ${submissions.length} arguments follow, reproduced exactly as submitted.`,
    `Each advocate wrote independently and saw no other advocate's argument.`,
    `An argument is a submission, not evidence: only the agreed facts are`,
    `established. You have not conferred with the other judges, you will not see`,
    `their opinions, and you must not refer to them.`,
    ``,
    arguments_.join("\n\n"),
    ``,
    `Give your opinion now, as the single JSON object your seat requires.`,
  ].join("\n");

  return { system: buildSystemMessage(shared, prompt), user };
}
