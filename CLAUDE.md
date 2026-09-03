# CLAUDE.md — context for the agent working on this repository

## What this project is
The Tribunal: a multi-agent application for the ASE-26 running project.
Seven LLM agents deliberate one fixed case (T-001, The Realm v. Jon Snow) and
produce three independent judicial opinions that are shown side by side and are
never combined.

## What the course grades
Not the app. The course grades how the agent was directed, and only what can be
opened and verified in this repository. Four requirements are specific to this
project and outrank everything else:

1. The charge sheet is written as a specification, not free text. -> specs/charge-sheet.yaml
2. The seven agent prompts are written and versioned. -> prompts/**/*.yaml
3. The protocol reports three verdicts side by side, without combining them.
4. The progression from one model toward several is visible. -> config/run-*.yaml

Everything else (UI polish, database, auth, extra pages) is out of scope and
earns nothing.

## Hard rules for any agent working here
- Prompts are code. Never edit a prompt file without bumping its `version` and
  recording the change in docs/PROMPT-CHANGELOG.md.
- Never merge, average, rank or summarise the three judicial opinions. Three
  opinions in, three opinions out.
- The seat an advocate holds fixes only their procedural role. It must never fix
  their conclusion. Do not write "you must argue that Jon is innocent".
- Nothing outside specs/charge-sheet.yaml `agreed_facts` may be treated as
  established fact by any agent.
- A model failure must surface as a visible failure, never as a result.
- The OpenRouter API key lives on the server only. It never reaches the browser.
- Most of this system is plain code. The model is called exactly seven times per
  run and nowhere else.

## Stack
TypeScript, deployed on Vercel. One serverless function runs the deliberation.
No database: each run is written to runs/<timestamp>.json and committed.

## Working discipline
- Commit before invoking the agent on a task, and after.
- Atomic commits, honest messages. No single squashed "final" commit.
- PLAN.md is updated in the same turn as the work, never afterwards. It is the
  single source of truth for project status; see the note at the top of it.
