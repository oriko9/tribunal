# The Tribunal

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://tribunal-green.vercel.app)
[![OpenRouter](https://img.shields.io/badge/LLMs%20via-OpenRouter-6566F1)](https://openrouter.ai/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**Seven LLM agents argue and decide a fictional criminal case and return three
independent judicial opinions. The opinions appear side by side and are never
merged.**

**Live demo:** https://tribunal-green.vercel.app

---

## 1. Project Overview

The Tribunal is a multi-agent deliberation system built around one fixed case:
**T-001, *The Realm v. Jon Snow*.** The case is taken from the ending of
*Game of Thrones*. Did Jon Snow have legal justification for killing Daenerys
Targaryen as a necessary defence of others and of the realm?

The deliberation runs as a two-phase protocol with exactly **seven model calls**:

| Phase | Agents | What they see | What they produce |
|---|---|---|---|
| **1. Advocacy** (4 calls, in parallel) | Jon Snow and Tyrion Lannister for the defence; Daenerys Targaryen and Grey Worm for the prosecution | The charge sheet only. No advocate sees another advocate's output. | A structured JSON argument with a stance, cited fact IDs and concessions |
| **2. Judgment** (3 calls, in parallel) | Three judges, each modelled on a different judicial method (rights-centred, tradition-minded, institutional) | The charge sheet plus all four arguments. No judge sees another judge's output. | A structured JSON opinion with a verdict, reasoning steps and a weighing of every required factor |

Every run produces **three verdicts side by side**. The system never
averages, ranks, takes a majority of or summarises those verdicts. Three
opinions go in and three come out. The charge sheet forbids aggregation
(`scope.the_tribunal_must_not`), and the code enforces it: nothing in the
orchestrator reads or compares the opinions.

The system runs in two configurations so that the step from one model to
several can be compared directly:

- **Mode A** ([`config/run-single.yaml`](config/run-single.yaml)): one model for all seven seats. The prompt is the only difference between agents.
- **Mode B** ([`config/run-multi.yaml`](config/run-multi.yaml)): a different model for each seat, from OpenAI, Anthropic and Google, all reached through OpenRouter. The prompts are the same as in mode A, so the model is the only variable that changes.

---

## 2. Architecture & LLM Integration

```
                       ┌────────────────────────────────────────────┐
  npm run tribunal ──▶ │ src/cli.ts                                 │
  (local, CLI)         │   loads spec + prompts + config (YAML)     │
                       │   orchestrator: 4 advocates ║ → 3 judges ║ │──▶ OpenRouter
                       │   gates: contract + fact grounding         │    (chat/completions)
                       │   writes runs/<timestamp>.json + .md       │
                       └───────────────┬────────────────────────────┘
                                       │ git commit
                                       ▼
  Browser ──▶ public/ (static) ──▶ api/runs.ts      reads committed run files only;
                                                    no model call, no API key
          └──────────────────────▶ api/live-seat.ts one seat per invocation, mode A only;
                                                    the only server path that holds the key
```

### Stateless and serverless on Vercel Functions

The deployment has two serverless functions and a static front end. It has
no database, no queue and no session store.

- **[`api/runs.ts`](api/runs.ts): the archive.** It lists and returns run
  files that were committed to `runs/`. [`vercel.json`](vercel.json) bundles
  them into the function with `includeFiles`. The function reads the files
  from the deployed filesystem. It imports no provider code, never reads the
  OpenRouter key and never calls a model. Run IDs must match a strict
  timestamp pattern before the function touches the filesystem.
- **[`api/live-seat.ts`](api/live-seat.ts): the live run.** Each invocation
  runs one agent's seat. The browser coordinates the run: it calls the
  four advocates in parallel and then, only if all four succeed, the three
  judges in parallel. The function reads only `agentId` from the request.
  The mode and model are fixed on the server, and a client-supplied `mode`
  or `model` field never reaches model selection. A smoke check verifies
  this.

### Why no database

This was a deliberate design choice. **Committed run files are the system's
only record.** Each CLI run writes a JSON file that can be read by code and a
Markdown protocol that can be read by people. The output is then committed
to git, which makes it:

- **Lightweight:** no storage service to provision, migrate, secure or pay
  for.
- **Fast:** the archive endpoint does a file read from the bundled function.
  It makes no network hop to a data store.
- **Cost-effective:** a page view never spends money. Model calls happen only
  when someone runs a deliberation on purpose.
- **Auditable:** every opinion has a commit, a diff and a history. The same
  prompts, the same config and the same output can be reviewed together.

### Designed around the 60-second limit

A full deliberation takes **56–96 seconds** depending on the mode. Vercel's
free tier stops a function after **60 seconds**. A single "run everything"
endpoint would therefore fail some of the time and still bill for the calls
it made before the timeout. The live path splits the protocol into
**one invocation per seat**. Measured live calls took 5–33 seconds, well
inside the limit. Because each invocation is stateless, the judge phase gets
the advocates' text back from the browser. That trust boundary is documented
in the code and on the page, and it is the reason the committed archive, not
a live run, is the record.

### LLM integration through OpenRouter

- **One call path.** The CLI and `api/live-seat.ts` both call the same
  `callAgent()` ([`src/orchestrator.ts`](src/orchestrator.ts)), so the
  gates, parsing and failure handling are identical in both paths.
- **Provider abstraction** ([`src/providers/`](src/providers/)): a
  `ModelProvider` interface with two implementations.
  - `openrouter`: live calls to `/api/v1/chat/completions` with a
    configurable timeout. Cost reporting comes from the provider
    (`usage.include`), and the actual USD cost is recorded for each call.
  - `mock`: deterministic synthetic replies that cost nothing. It supports
    **fault injection** (`invalid_json`, `empty`, `transport_error`,
    `declared_refusal`, …) so the failure path can be tested without waiting
    for a real model to fail.
- **Startup checks.** A live run is refused before any call if the key is
  missing, if any seat is unassigned, or if the config is malformed. Each
  config also sets a per-run budget (`max_usd_per_run`).
- **The key stays on the server.** `OPENROUTER_API_KEY` is read in one
  place, used in one `Authorization` header and never logged, written to a
  run file or sent to the browser.

---

## 3. Technical Highlights

> **Authorship:** This is an individual academic assignment for an LLM
> engineering course (ASE-26). The architecture, specifications, prompts and
> design decisions are all my own. I wrote the implementation by directing an
> AI coding agent. That process is what the course assesses, and it is
> recorded in [`PLAN.md`](PLAN.md) and the commit history.

### Prompts as versioned code

- **The charge sheet is a specification, not prose**
  ([`specs/charge-sheet.yaml`](specs/charge-sheet.yaml)). It defines
  identified agreed facts (`F1`–`F5`), required factors to weigh
  (`Q1`–`Q4`), permitted verdicts and explicit prohibitions. It is the only
  source of established fact in the system.
- **Seven prompt files with semantic versions**
  ([`prompts/`](prompts/)). Each file holds a persona, a declared
  **output contract** (a JSON schema with word ranges, enums and array
  bounds) and a version number. Rules that every agent shares (evidence,
  simulation, failure) live in a single [`_shared.yaml`](prompts/_shared.yaml),
  so a change applies to all seven agents and is versioned once.
- **Each prompt change is recorded**
  ([`docs/PROMPT-CHANGELOG.md`](docs/PROMPT-CHANGELOG.md)). Every version bump
  states what changed and why. Every run file records the exact prompt
  version each seat used.
- **The seat sets the role, not the conclusion.** No advocate is told what
  to argue. Advocates may take the stance `uncertain` and are asked for real
  concessions. The judges model judicial *methods*, not real people, and
  each prompt carries an explicit disclaimer saying so.

### Verification gates: failure versus deviation

Every reply goes through two gates ([`src/gates.ts`](src/gates.ts)). The
gates deliberately produce two different outcomes:

| Outcome | Trigger | Effect |
|---|---|---|
| **FAILURE** | Invalid JSON, a missing required field, a verdict outside `permitted_verdicts`, or a cited fact ID that does not exist in the charge sheet | The reply is **not a result**. It is shown as a visible failure and never as an opinion. |
| **DEVIATION** | Word count out of range, too few or too many reasoning steps, a factor left unweighed | The opinion **is kept** and the deviation is recorded and shown next to it. |

- **Fact grounding** catches hallucinated evidence. An opinion that cites
  `F7` against a five-fact record fails.
- **Lenient parsing is disclosed.** If a model wraps JSON in prose, the
  system recovers the JSON but marks `parse: "extracted"`.
- **`npm run verify-runs`** applies both gates again to every committed run
  without rewriting any of them. This tested the gates against real model
  output as well as synthetic fixtures.
- **`npm run smoke`** is an offline self-test that makes no model calls. It
  covers prompt structure, contract parsing, fault injection, failure
  surfacing and the guarantee that the live endpoint's mode and model are
  fixed.

### Lessons from real data

[`docs/LESSONS.md`](docs/LESSONS.md) records what the live runs showed and
links each claim to a committed run file or number. It covers four kinds of
real failure that no mock predicted, mode B's record of one success in three
live attempts, word-count contracts missed in both directions, and a prompt
change that did not measurably fix the problem it targeted.

### Where to look

| Course requirement | Evidence |
|---|---|
| Charge sheet as a specification | [`specs/charge-sheet.yaml`](specs/charge-sheet.yaml) |
| Seven versioned prompts | [`prompts/**/*.yaml`](prompts/), [`docs/PROMPT-CHANGELOG.md`](docs/PROMPT-CHANGELOG.md) |
| Three verdicts side by side, never combined | any `runs/<id>.md`, e.g. [`runs/2026-09-07T09-59-57-177Z.md`](runs/2026-09-07T09-59-57-177Z.md) (a complete mode B run) |
| From one model to several | [`config/run-single.yaml`](config/run-single.yaml) vs [`config/run-multi.yaml`](config/run-multi.yaml), [`docs/mode-a-vs-b.md`](docs/mode-a-vs-b.md) |

### Repository layout

```
specs/     the charge sheet specification
prompts/   the seven agent prompts and shared rules, versioned
config/    run configurations: mode A (single model), mode B (multi-model)
src/       orchestrator, gates, providers, CLI, protocol renderer, smoke tests
api/       two Vercel functions: runs.ts (archive), live-seat.ts (one live seat)
public/    static front end (HTML/CSS/JS, no framework)
runs/      committed output of every run: JSON + Markdown protocol, with cost
docs/      prompt changelog, model notes, mode comparison, lessons learned
```

---

## 4. Quick Start / Local Setup

**Prerequisites:** Node.js 20 or later and npm. An
[OpenRouter API key](https://openrouter.ai/keys) is needed only for live runs.

### 1. Clone and install

```bash
git clone https://github.com/oriko9/tribunal.git
cd tribunal
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local      # PowerShell: Copy-Item .env.local.example .env.local
```

`.env.local` is ignored by git, and the npm scripts load it automatically
(`node --env-file-if-exists`). The defaults run against the **mock provider**,
which needs no key and costs nothing.

| Variable | Default | Purpose |
|---|---|---|
| `TRIBUNAL_PROVIDER` | `mock` | `mock` (offline, free) or `openrouter` (live, paid) |
| `OPENROUTER_API_KEY` | *(empty)* | Your OpenRouter key. Required only when the provider is `openrouter`. |
| `TRIBUNAL_MOCK_FAULTS` | *(empty)* | Faults to inject into the mock, e.g. `jon_snow=invalid_json,judge_barak_model=empty` |
| `TRIBUNAL_TIMEOUT_MS` | `120000` | Timeout for each live call |

### 3. Verify and run

```bash
npm run typecheck                 # TypeScript compile check
npm run smoke                     # offline self-test, no model calls
npm run tribunal -- single        # mode A: one model, seven prompts
npm run tribunal -- multi         # mode B: a different model for each seat
npm run verify-runs               # apply both gates again to every committed run
```

Each `tribunal` run writes `runs/<timestamp>.json` and a matching `.md`
protocol that shows the three opinions side by side.

### 4. Run against real models (optional, paid)

In `.env.local`:

```bash
TRIBUNAL_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
```

Each config sets a budget of `max_usd_per_run: 0.50`. The actual cost of
every call is recorded in the run file.

### 5. Serve the web UI locally (optional)

```bash
npx vercel dev                    # needs a logged-in Vercel CLI
```

The archive view works without a key. The live-run button needs
`OPENROUTER_API_KEY` in the environment of the function: `.env.local`
locally, or the Vercel project's environment variables when deployed.
