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
| 2026-09-06 | `config/run-single.yaml` (mode A) | `openai/gpt-5-nano`, all seven seats | **First fully successful paid run.** All 7 seats returned strict JSON (`parse: "strict"` throughout), no refusal, no fact identifier outside F1–F5. Every advocate landed inside its word range. All three judges came back `not_justified` — mode A's 09-05 free-tier run on nemotron split 1 `justified` / 2 `not_justified`, so agreement here is not assumed to generalise from one run each. A new contract deviation, opposite of 09-05's: all three judge opinions came in *under* the 300-500 word floor (233, 274, 279 words), not over it. Real cost, provider-reported: **$0.013167** for 49,515 tokens (18,969 prompt, 30,546 completion) across all seven calls, well under the $0.50 budget. Wall clock 56.2 s, each call 22-30 s — far more consistent than the free-tier runs' 12-65 s spread. Recorded as evidence: `runs/2026-09-06T07-51-57-229Z.{json,md}`. Mode B not run this session by instruction, pending review of this cost. |
| 2026-09-07 | `config/run-multi.yaml` (mode B) | `openai/gpt-oss-120b` (daenerys_targaryen), `openai/gpt-oss-20b` (grey_worm), `openai/gpt-5-nano` (jon_snow), `openai/gpt-5.4-mini` (tyrion_lannister), plus three judge-assigned models never invoked | **A third, different failure kind: our own account, not a model.** 3 of 4 advocates succeeded (daenerys_targaryen, grey_worm, jon_snow — 38-44 s each). `tyrion_lannister` (openai/gpt-5.4-mini) failed in 621 ms with HTTP 402, `limit_source: "openrouter_key_limit"`: "requested up to 65536 tokens, but can only afford 37744." This is OpenRouter's own pre-flight check against the API key's total spending cap, not a per-project budget — `budget.max_usd_per_run` in the run file shows `exceeded: false` at $0.0033, since the call was rejected before generating anything and never reached that check. The client sends no `max_tokens`, so the model's own large default output ceiling was priced against the *worst case*, not what it would likely have used — and the three concurrent successful calls had already drawn down the key's remaining balance below what that worst case required. 1 of 4 advocates down was enough to stop the judges sitting for a third time. Recorded as evidence: `runs/2026-09-07T09-46-50-573Z.{json,md}`. |
| 2026-09-07 | `config/run-multi.yaml` (mode B), retried after the key's spending limit was raised | `openai/gpt-oss-120b` (daenerys_targaryen), `openai/gpt-oss-20b` (grey_worm), `openai/gpt-5-nano` (jon_snow), `openai/gpt-5.4-mini` (tyrion_lannister), `openai/gpt-5.6-luna` (judge_barak_model), `anthropic/claude-haiku-4.5` (judge_elon_model), `google/gemini-3.1-flash-lite` (judge_shamgar_model) | **First time mode B has ever reached the judges.** All 7 seats succeeded. All three verdicts came back `not_justified`, matching mode A's paid run on 09-06 — reported as what happened, not evidence that the modes converge from one run each. Word-count contract missed in three different ways in one run: `grey_worm` (180-300 words) returned 152, under the floor — the first advocate-level miss recorded; `judge_elon_model` (300-500 words) returned 523, over the ceiling, and also arrived fenced (`parse: "extracted"`); `judge_barak_model` and `judge_shamgar_model` stayed inside range (383, 302). Real cost **$0.025956** for 34,862 tokens — roughly double mode A's paid run, with `judge_elon_model`/claude-haiku-4.5 alone accounting for $0.014118, over half the total. Wall clock 96.3 s, individual calls spanning 4.1 s to 74.7 s — a far wider spread than any single-model run. Recorded as evidence: `runs/2026-09-07T09-59-57-177Z.{json,md}`. Full comparison against the 09-06 mode A run: `docs/mode-a-vs-b.md`. |
| 2026-09-07 | `config/run-single.yaml` (mode A), prompts at **1.1.0** | `openai/gpt-5-nano`, all seven seats | First live run since the judge prompts were changed to restate the 300-500 word bound inside `system_prompt` (see `docs/PROMPT-CHANGELOG.md`, 1.1.0). Result: Barak 302 words, in range; Elon 248 and Shamgar 239, both under the floor — 1 of 3 judges in range, a 67% deviation rate numerically unchanged from the 6-of-9 baseline the change targeted, on a sample of one run. Both misses undershot this time, where the pre-1.1.0 pattern was mixed over/under — a possible sign the wording pushed toward brevity rather than toward the range, or simply noise on three data points. All four advocates stayed in range, as expected since their wording did not change. Not treated as evidence the change worked or didn't. Recorded as evidence: `runs/2026-09-07T12-42-32-415Z.{json,md}`. |
