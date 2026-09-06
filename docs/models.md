# Models

## Why this project moved off the free tier

Two live attempts at mode B on 2026-09-06 settled the question of whether the
free tier can support a seven-model run: it cannot, not reliably enough to be
worth another try. Across four live model choices tried before that decision
— two in mode A (09-03, 09-05), seven across the two mode B attempts (09-06)
— the free tier produced three distinct failure kinds that had nothing to do
with this project's code, its prompts, or its own account limits:

- **Upstream shared-pool rate limiting** (`limit_source:
  upstream_provider_shared_pool`) — the free tier of a given model saturated
  across every OpenRouter user at the moment of the call. Hit
  `google/gemma-4-31b-it:free`, most of `z-ai/glm-5.2:free`, and two of mode
  B attempt 1's seven.
- **A silent timeout** — a call that never returns anything at all and is
  aborted by our own 120 s client-side timeout, not a provider error.
  Mode B attempt 1's `nvidia/nemotron-3.5-lightning:free`.
- **An access-tier 403** — a model listed as free that rejects a plain chat
  request outright (`"only available on agentic harnesses"`). Both
  ThinkingMachines models in mode B attempt 2.

Mode B — the graded requirement that a different model can sit behind each
seat — never once reached the judges in either attempt: both times, too few
of the seven independently-chosen free models were available at the same
moment for the protocol's "all four arguments or the judges do not sit" rule
to be satisfied. The full attempt history is kept below, unedited, as the
evidence for this decision. See `docs/mode-a-vs-b.md` for the comparison this
was run to produce.

The seven models now assigned in `config/run-single.yaml` and
`config/run-multi.yaml` are paid. A live run now costs real money — see
`runs/` for what each one actually cost, recorded per call and as a run
total, never estimated.

## Free models on OpenRouter

Generated 2026-09-06T07:47:49.740Z by `npm run models`, querying https://openrouter.ai/api/v1/models.
431 models scanned; a model is free here when both its prompt and
completion pricing are exactly 0, as reported by the endpoint at the time this
file was generated. OpenRouter's free tier changes over time — this is a
snapshot, not a standing guarantee. Re-run `npm run models` before relying on it.

Models with a reported context length under 32,000 tokens are
excluded from the table below: a judge's prompt already carries the charge
sheet and all four advocate arguments, close to 4,000 tokens before the model
writes a word, and that grows as the arguments do.

Kept for the record, not for a future pick: see the rationale above this
section for why the project moved off the free tier.

### Free models, sorted by context length (descending)

| Model id | Context length | Max completion tokens | Per-request limits |
|---|---|---|---|
| `thinkingmachines/inkling-small:free` | 1,048,576 | 262,144 | none reported |
| `thinkingmachines/inkling:free` | 1,048,576 | 262,144 | none reported |
| `minimax/minimax-m3:free` | 1,048,576 | 943,718 | none reported |
| `google/lyria-3-pro-preview` | 1,048,576 | 65,536 | none reported |
| `google/lyria-3-clip-preview` | 1,048,576 | 65,536 | none reported |
| `nvidia/nemotron-3.5-lightning:free` | 1,000,000 | 65,536 | none reported |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1,000,000 | 65,536 | none reported |
| `dots-studio/dots-3-note-preview:free` | 512,000 | 460,800 | none reported |
| `inclusionai/ling-3.0-flash-sante:free` | 262,144 | 32,768 | none reported |
| `inclusionai/ling-3.0-flash-fin:free` | 262,144 | 32,768 | none reported |
| `poolside/laguna-s-2.1:free` | 262,144 | 32,768 | none reported |
| `poolside/laguna-xs-2.1:free` | 262,144 | 32,768 | none reported |
| `google/gemma-4-26b-a4b-it:free` | 262,144 | 32,768 | none reported |
| `google/gemma-4-31b-it:free` | 262,144 | 32,768 | none reported |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262,144 | 235,929 | none reported |
| `cohere/north-mini-code:free` | 256,000 | 64,000 | none reported |
| `z-ai/glm-5.2:free` | 256,000 | 230,400 | none reported |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256,000 | 65,536 | none reported |
| `openrouter/free` | 200,000 | not reported | none reported |
| `minimax/minimax-m2.7:free` | 196,608 | 176,947 | none reported |
| `nvidia/nemotron-3.5-content-safety:free` | 128,000 | 8,192 | none reported |
| `liquid/lfm-2.5-2.6b:free` | 65,536 | 8,192 | none reported |

### Free but rejected for context length under 32,000

_none found_


## Live attempts against mode A

Manually maintained below this line. `npm run models` regenerates everything
between the two headings above it; this section records what happened when a
model from the table was actually put in `config/run-single.yaml` and run.

| Date | Model | Result |
|---|---|---|
| 2026-09-03 | `google/gemma-4-31b-it:free` | All 7 calls failed identically: HTTP 429 from OpenRouter within ~0.6s, `limit_source: "upstream_provider_shared_pool"`, provider Google AI Studio. Not our own 20/min or 50/day account limit — the free tier of this specific model was saturated across all OpenRouter users at the time. Recorded as evidence: `runs/2026-09-03T15-52-06-756Z.{json,md}`. The pipeline surfaced this as a loud failure on every advocate and correctly left the judges `not_run`, rather than substituting anything. |
| 2026-09-05 | `z-ai/glm-5.2:free` | 3 of 4 advocates hit the same upstream 429 (`limit_source: "upstream_provider_shared_pool"`, provider Decart), but `tyrion_lannister` got a real reply: a 303-word, in-character argument citing all five facts correctly, no fabricated fact id, no refusal. It arrived wrapped in a ```` ```json ```` fence, which the contract forbids — the orchestrator recovered it (`parse: "extracted"`) rather than failing it outright. With 3 of 4 advocates down, the judges correctly did not sit. Recorded as evidence: `runs/2026-09-05T17-33-45-295Z.{json,md}`. |
| 2026-09-05 | `nvidia/nemotron-3-super-120b-a12b:free` | **First fully successful live run.** All 7 seats returned strict, unfenced JSON (`parse: "strict"` throughout) — no fenced replies this time, no refusal, and no fact identifier cited that isn't in F1–F5, across all seven agents. Calls were slow (12–65 s each) but all landed inside the 120 s timeout. One real, concrete deviation from the mock: the output contract asks judges for a 300–500 word opinion, and two of the three judges went well over it — Barak 580 words, Elon 617 words — while Shamgar came in at 345, inside range. No judge referred to another judge or another judge's name, holding the independence rule. The three verdicts split: Barak `justified`, Elon and Shamgar `not_justified` — reported side by side, uncombined. Recorded as evidence: `runs/2026-09-05T17-35-07-358Z.{json,md}`. |

## Live attempts against mode B

Mode B assigns seven distinct models, one per seat — the graded requirement
that had never run before 2026-09-06. Two attempts were made, per instruction
to try a second, different set of seven if the first failed on rate limits,
then stop regardless of the second outcome and report back rather than
retrying further.

| Date | Seven models | Result |
|---|---|---|
| 2026-09-06, attempt 1 | `google/gemma-4-26b-a4b-it` (jon_snow), `minimax/minimax-m3` (tyrion_lannister), `nvidia/nemotron-3.5-lightning` (daenerys_targaryen), `poolside/laguna-s-2.1` (grey_worm), `z-ai/glm-5.2` (judge_barak_model), `nvidia/nemotron-3-super-120b-a12b` (judge_elon_model), `minimax/minimax-m2.7` (judge_shamgar_model) | 3 of 4 advocates failed before the judges could sit: `grey_worm` and `jon_snow` hit the familiar `upstream_provider_shared_pool` 429, and `daenerys_targaryen` (nemotron-3.5-lightning) simply never answered — the call ran the full 120 s and was aborted on timeout, a failure mode mode A had not yet produced. Only `tyrion_lannister` (minimax-m3) returned a real reply. None of the three judge-assigned models were ever invoked, since the judges correctly did not sit on 3 of 4 arguments. Recorded as evidence: `runs/2026-09-06T07-24-33-092Z.{json,md}`. |
| 2026-09-06, attempt 2 | `thinkingmachines/inkling-small` (jon_snow), `nvidia/nemotron-3-ultra-550b-a55b` (tyrion_lannister), `thinkingmachines/inkling` (daenerys_targaryen), `liquid/lfm-2.5-2.6b` (grey_worm), `poolside/laguna-xs-2.1` (judge_barak_model), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (judge_elon_model), `dots-studio/dots-3-note-preview` (judge_shamgar_model) — seven ids, none repeated from attempt 1 | Different failure kind this time, not a rate limit: both ThinkingMachines models returned HTTP 403, `"is only available on agentic harnesses"` — the free listing exists but OpenRouter gates it away from a plain chat request. `grey_worm` (liquid/lfm-2.5-2.6b) and `tyrion_lannister` (nemotron-3-ultra-550b-a55b) both returned real replies. 2 of 4 advocates down was still enough to stop the judges from sitting; none of the three judge-assigned models were invoked. Recorded as evidence: `runs/2026-09-06T07-27-39-545Z.{json,md}`. |

Across both attempts, mode B never produced a single judge opinion: every
failure happened at the advocate stage, before the protocol's "all four
arguments or the judges do not sit" rule ever got the chance to be tested
against a real judge call. Four distinct real-world failure modes appeared
across the two mode A models (09-03, 09-05) and these two mode B attempts:
upstream shared-pool rate limiting, a silent timeout, and an access-tier
403 — none of them something a mock could have shown, and none of them our
own OpenRouter account limit. Assigning seven independent models to one run
multiplies the chances that at least one of them is having a bad moment,
which is exactly what both attempts show, and is the reason recorded above
for moving both run configurations to paid models.

## Live attempts against paid models

Manually maintained. Records what happened once `config/run-single.yaml` and
`config/run-multi.yaml` were pointed at paid models on 2026-09-06.

| Date | Config | Models | Result |
|---|---|---|---|
