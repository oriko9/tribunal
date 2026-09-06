# Free models on OpenRouter

Generated 2026-09-06T07:23:29.931Z by `npm run models`, querying https://openrouter.ai/api/v1/models.
431 models scanned; a model is free here when both its prompt and
completion pricing are exactly 0, as reported by the endpoint at the time this
file was generated. OpenRouter's free tier changes over time — this is a
snapshot, not a standing guarantee. Re-run `npm run models` before relying on it.

Models with a reported context length under 32,000 tokens are
excluded from the table below: a judge's prompt already carries the charge
sheet and all four advocate arguments, close to 4,000 tokens before the model
writes a word, and that grows as the arguments do.

## Free models, sorted by context length (descending)

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

## Free but rejected for context length under 32,000

_none found_


## Live attempts against mode A

Manually maintained below this line. `npm run models` regenerates everything
above it; this section records what happened when a model from the table was
actually put in `config/run-single.yaml` and run.

| Date | Model | Result |
|---|---|---|
| 2026-09-03 | `google/gemma-4-31b-it:free` | All 7 calls failed identically: HTTP 429 from OpenRouter within ~0.6s, `limit_source: "upstream_provider_shared_pool"`, provider Google AI Studio. Not our own 20/min or 50/day account limit — the free tier of this specific model was saturated across all OpenRouter users at the time. Recorded as evidence: `runs/2026-09-03T15-52-06-756Z.{json,md}`. The pipeline surfaced this as a loud failure on every advocate and correctly left the judges `not_run`, rather than substituting anything. |
| 2026-09-05 | `z-ai/glm-5.2:free` | 3 of 4 advocates hit the same upstream 429 (`limit_source: "upstream_provider_shared_pool"`, provider Decart), but `tyrion_lannister` got a real reply: a 303-word, in-character argument citing all five facts correctly, no fabricated fact id, no refusal. It arrived wrapped in a ```` ```json ```` fence, which the contract forbids — the orchestrator recovered it (`parse: "extracted"`) rather than failing it outright. With 3 of 4 advocates down, the judges correctly did not sit. Recorded as evidence: `runs/2026-09-05T17-33-45-295Z.{json,md}`. |
| 2026-09-05 | `nvidia/nemotron-3-super-120b-a12b:free` | **First fully successful live run.** All 7 seats returned strict, unfenced JSON (`parse: "strict"` throughout) — no fenced replies this time, no refusal, and no fact identifier cited that isn't in F1–F5, across all seven agents. Calls were slow (12–65 s each) but all landed inside the 120 s timeout. One real, concrete deviation from the mock: the output contract asks judges for a 300–500 word opinion, and two of the three judges went well over it — Barak 580 words, Elon 617 words — while Shamgar came in at 345, inside range. No judge referred to another judge or another judge's name, holding the independence rule. The three verdicts split: Barak `justified`, Elon and Shamgar `not_justified` — reported side by side, uncombined. Recorded as evidence: `runs/2026-09-05T17-35-07-358Z.{json,md}`. |

