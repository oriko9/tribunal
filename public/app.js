// No framework, no build step. Fetches a committed run from the one
// serverless function (api/runs.ts) and renders it. Nothing here calls a
// model or touches the OpenRouter key — that key never reaches the browser.

const DEFAULT_RUN_ID = "2026-09-07T09-59-57-177Z"; // mode B, complete, three real opinions

const select = document.getElementById("run-select");
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const result = document.getElementById("result");

const liveBtn = document.getElementById("live-btn");
const liveStatusEl = document.getElementById("live-status");
const liveProgressEl = document.getElementById("live-progress");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function formatDate(iso) {
  if (!iso) return "unknown time";
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace("Z", " UTC");
}

function modeLabel(mode) {
  if (mode === "single_model") return "Mode A";
  if (mode === "multi_model") return "Mode B";
  return mode;
}

function optionLabel(run) {
  const statusWord = run.status === "complete" ? "complete" : `incomplete — ${run.callsOk}/${run.callsOk + run.callsFailed} ok`;
  return `${modeLabel(run.mode)} — ${formatDate(run.startedAt)} — ${statusWord}`;
}

async function loadRunList() {
  statusEl.textContent = "Loading the list of committed runs…";
  const response = await fetch("/api/runs");
  if (!response.ok) throw new Error(`could not list runs (HTTP ${response.status})`);
  const data = await response.json();
  const runs = data.runs || [];
  if (runs.length === 0) throw new Error("no committed runs found in runs/");

  select.innerHTML = "";
  for (const run of runs) {
    select.appendChild(el("option", { value: run.id, text: optionLabel(run) }));
  }

  // Default to the run that shows three real opinions from seven different
  // models, per instruction — falling back to the newest run if that one is
  // ever missing.
  select.value = runs.some((r) => r.id === DEFAULT_RUN_ID) ? DEFAULT_RUN_ID : runs[0].id;

  select.disabled = false;
  loadBtn.disabled = false;
  statusEl.textContent = `${runs.length} committed run(s) available.`;
}

function cell(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function joinList(value) {
  return Array.isArray(value) ? value.join(", ") : cell(value);
}

function bulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return el("p", { class: "meta", text: "none stated" });
  }
  return el(
    "ul",
    {},
    items.map((item) => el("li", { text: typeof item === "string" ? item : JSON.stringify(item) })),
  );
}

function protocolStepsList(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return el("p", { class: "meta", text: "not provided" });
  }
  return el(
    "ol",
    {},
    steps.map((step) => {
      if (step && typeof step === "object") {
        const parts = Object.entries(step)
          .map(([key, value]) => `<strong>${key}:</strong> ${cell(value)}`)
          .join(" — ");
        return el("li", { html: parts });
      }
      return el("li", { text: cell(step) });
    }),
  );
}

function factorsTable(factors) {
  if (!factors || typeof factors !== "object") {
    return el("p", { class: "meta", text: "not provided" });
  }
  const table = el("table");
  table.appendChild(
    el("tr", {}, [el("th", { text: "Factor" }), el("th", { text: "Answer" })]),
  );
  for (const [key, value] of Object.entries(factors)) {
    table.appendChild(el("tr", {}, [el("td", { text: key }), el("td", { text: cell(value) })]));
  }
  return table;
}

/** Fields already rendered explicitly; anything else in `output` is shown generically, for parity with runs/<id>.md. */
const ADVOCATE_HANDLED = new Set(["speaker", "stance", "argument", "facts_relied_on", "concessions", "refusal"]);
const JUDGE_HANDLED = new Set([
  "judge", "verdict", "protocol_steps", "opinion", "factors_addressed",
  "facts_relied_on", "strongest_opposing_point", "refusal",
]);

function extraFields(output, handled) {
  if (!output || typeof output !== "object") return [];
  const nodes = [];
  for (const [key, value] of Object.entries(output)) {
    if (handled.has(key)) continue;
    nodes.push(el("h4", { text: key }));
    nodes.push(Array.isArray(value) ? bulletList(value) : el("p", { text: cell(value) }));
  }
  return nodes;
}

/** A seat that did not return usable output. Never omitted, never substituted. */
/** Shown next to the seat regardless of status — a deviation never disqualifies a reply. */
function deviationsBlock(record) {
  if (!record.deviations || record.deviations.length === 0) return el("span", { text: "" });
  const box = el("div", { class: "deviation" });
  box.appendChild(el("strong", { text: "Deviations from the contract" }));
  box.appendChild(
    el(
      "ul",
      {},
      record.deviations.map((d) => el("li", { html: `<code>${d.field}</code> (${d.kind}): ${cell(d.message)}` })),
    ),
  );
  return box;
}

function failureCard(record) {
  const card = el("section", { class: "card failed" });
  card.appendChild(el("h3", { text: record.display_name }));
  card.appendChild(
    el("p", { html: `<span class="status-bad">${record.status === "not_run" ? "did not sit" : "failed"}</span> — ${cell(record.failure && record.failure.kind)}` }),
  );
  card.appendChild(el("p", { text: (record.failure && record.failure.message) || "no reason recorded" }));
  if (record.raw_text) {
    card.appendChild(el("p", { class: "meta", text: "What the model returned, unaltered:" }));
    card.appendChild(el("pre", { text: record.raw_text.slice(0, 2000) }));
  }
  card.appendChild(el("p", { class: "meta", text: "Nothing has been substituted for this seat." }));
  card.appendChild(deviationsBlock(record));
  return card;
}

function advocateCard(record) {
  if (record.status !== "ok") return failureCard(record);
  const out = record.output || {};
  const card = el("section", { class: "card" });
  card.appendChild(el("h3", { text: `${record.display_name} — ${record.seat || "advocate"}` }));
  card.appendChild(el("p", { html: `<strong>Stance:</strong> ${cell(out.stance)}` }));
  card.appendChild(el("p", { html: `<strong>Facts relied on:</strong> ${joinList(out.facts_relied_on)}` }));
  card.appendChild(el("p", { text: out.argument || "" }));
  card.appendChild(el("h4", { text: "Concessions" }));
  card.appendChild(bulletList(out.concessions));
  for (const node of extraFields(out, ADVOCATE_HANDLED)) card.appendChild(node);
  card.appendChild(deviationsBlock(record));
  return card;
}

function opinionCard(record) {
  if (record.status !== "ok") return failureCard(record);
  const out = record.output || {};
  const card = el("section", { class: "card" });
  card.appendChild(el("h3", { text: record.display_name }));
  card.appendChild(el("p", { html: `<strong>Verdict:</strong> ${cell(out.verdict)}` }));
  card.appendChild(el("h4", { text: "How this verdict was reached" }));
  card.appendChild(protocolStepsList(out.protocol_steps));
  card.appendChild(el("h4", { text: "The four factors the tribunal must weigh" }));
  card.appendChild(factorsTable(out.factors_addressed));
  card.appendChild(el("p", { html: `<strong>Facts relied on:</strong> ${joinList(out.facts_relied_on)}` }));
  card.appendChild(
    el("p", { html: `<strong>Strongest point against this conclusion:</strong> ${cell(out.strongest_opposing_point)}` }),
  );
  card.appendChild(el("h4", { text: "Opinion" }));
  card.appendChild(el("p", { text: out.opinion || "" }));
  for (const node of extraFields(out, JUDGE_HANDLED)) card.appendChild(node);
  card.appendChild(deviationsBlock(record));
  return card;
}

function costTable(run) {
  const table = el("table");
  table.appendChild(
    el("tr", {}, [
      "Seat", "Model", "Status", "Prompt tokens", "Completion tokens", "Total tokens", "Cost (USD)",
    ].map((text) => el("th", { text }))),
  );
  for (const row of run.usage.calls) {
    table.appendChild(
      el("tr", {}, [
        el("td", { text: row.agent_id }),
        el("td", { text: row.model }),
        el("td", { text: row.status }),
        el("td", { text: cell(row.prompt_tokens) }),
        el("td", { text: cell(row.completion_tokens) }),
        el("td", { text: cell(row.total_tokens) }),
        el("td", { text: row.cost_usd === null ? "—" : row.cost_usd.toFixed(6) }),
      ]),
    );
  }
  const t = run.usage.totals;
  const costText = t.pricing === "synthetic" ? `${t.cost_usd.toFixed(6)} (synthetic)` : t.cost_usd.toFixed(6);
  table.appendChild(
    el("tr", {}, [
      el("td", { html: "<strong>Run total</strong>" }),
      el("td", { text: "" }),
      el("td", { text: `${t.calls_ok} ok, ${t.calls_failed} failed` }),
      el("td", { html: `<strong>${t.prompt_tokens}</strong>` }),
      el("td", { html: `<strong>${t.completion_tokens}</strong>` }),
      el("td", { html: `<strong>${t.total_tokens}</strong>` }),
      el("td", { html: `<strong>${costText}</strong>` }),
    ]),
  );
  return table;
}

function renderRun(run) {
  result.innerHTML = "";

  const header = el("section");
  header.appendChild(el("h2", { text: `${run.run.case.id} — ${run.run.case.title}` }));
  const meta = el("table");
  const rows = [
    ["Mode", run.run.label],
    ["Provider", run.run.provider.description],
    ["Charge sheet", `spec_version ${run.run.case.spec_version}`],
    ["Started", formatDate(run.run.started_at)],
    ["Ended", formatDate(run.run.ended_at)],
    ["Duration", `${(run.run.duration_ms / 1000).toFixed(2)} s`],
    [
      "Status",
      run.run.status === "complete"
        ? "complete — all seven seats returned usable output"
        : `incomplete — ${run.usage.totals.calls_failed} of ${run.usage.calls.length} seats failed`,
    ],
  ];
  for (const [key, value] of rows) {
    meta.appendChild(el("tr", {}, [el("th", { text: key }), el("td", { text: value })]));
  }
  header.appendChild(meta);

  if (run.run.failures && run.run.failures.length > 0) {
    header.appendChild(el("h4", { text: "Failures in this run" }));
    header.appendChild(bulletList(run.run.failures));
  }
  result.appendChild(header);

  result.appendChild(el("h2", { text: "The advocates" }));
  result.appendChild(
    el("p", {
      class: "meta",
      text: "Four advocates, each writing from the charge sheet alone. None of them saw another advocate's argument.",
    }),
  );
  for (const record of run.advocates) result.appendChild(advocateCard(record));

  result.appendChild(el("h2", { text: "The opinions" }));
  result.appendChild(
    el("div", {
      class: "notice",
      text:
        "These three opinions are not combined, merged, ranked, averaged or summarised anywhere " +
        "on this page or in this project. No majority or overall verdict is derived from them. " +
        "They are shown below in a fixed order, and that order is not an order of merit.",
    }),
  );
  const opinionIds = Object.keys(run.opinions).sort(); // fixed, alphabetical by agent id — never by verdict
  for (const id of opinionIds) result.appendChild(opinionCard(run.opinions[id]));

  result.appendChild(el("h2", { text: "Cost" }));
  result.appendChild(costTable(run));
}

async function loadSelectedRun() {
  const id = select.value;
  if (!id) return;
  loadBtn.disabled = true;
  statusEl.textContent = "Loading run…";
  try {
    const response = await fetch(`/api/runs?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    const run = await response.json();
    renderRun(run);
    statusEl.textContent = `Loaded ${id}.`;
  } catch (cause) {
    statusEl.textContent = `Could not load that run: ${cause.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadSelectedRun);

// --- live runs ---------------------------------------------------------
//
// Additive: everything above this line is the archive view, unchanged.
// A live run calls /api/live-seat once per seat — four advocates in
// parallel, then, only if all four succeed, three judges in parallel — and
// assembles a run object shaped exactly like a committed run file, so it can
// be handed to the same renderRun() the archive uses. Nothing here writes to
// runs/; a live run exists only in this page until it is replaced or the
// page is closed.

const ADVOCATE_IDS = ["daenerys_targaryen", "grey_worm", "jon_snow", "tyrion_lannister"];
const JUDGE_IDS = ["judge_barak_model", "judge_elon_model", "judge_shamgar_model"];

/** meta.seats identity for one agent id, or an honest stand-in if meta hasn't arrived yet. */
function seatIdentity(agentId, meta) {
  const found = meta && Array.isArray(meta.seats) ? meta.seats.find((s) => s.agent_id === agentId) : null;
  if (found) return found;
  return {
    agent_id: agentId,
    display_name: agentId,
    role: agentId.startsWith("judge_") ? "judge" : "advocate",
    seat: null,
    prompt_path: null,
    prompt_version: null,
    model: null,
  };
}

/** Used only if every single live call failed before any server response carried meta. */
function fallbackMeta() {
  return {
    case: { id: "T-001", title: "The Realm v. Jon Snow", spec: "specs/charge-sheet.yaml", spec_version: "—" },
    mode: "single_model",
    label: "A — one model, seven prompts",
    config: "config/run-single.yaml",
    provider: { name: "openrouter", pricing: "provider", description: "openrouter — live calls" },
    shared_rules: { path: "prompts/_shared.yaml", version: "—" },
    budget_usd: null,
    seats: [],
  };
}

/** A seat call that failed before the server could return a real CallRecord: network error, rate limit, misconfiguration. */
function syntheticFailure(agentId, message, meta) {
  const identity = seatIdentity(agentId, meta);
  const now = new Date().toISOString();
  return {
    agent_id: identity.agent_id,
    display_name: identity.display_name,
    role: identity.role,
    seat: identity.seat,
    prompt_path: identity.prompt_path,
    prompt_version: identity.prompt_version,
    model: identity.model,
    status: "failed",
    started_at: now,
    ended_at: now,
    duration_ms: 0,
    raw_text: null,
    output: null,
    parse: null,
    failure: { kind: "transport", message },
    deviations: [],
    usage: null,
  };
}

/** Mirrors orchestrator.ts's own not-run judge record, word for word, for the client-side skip path. */
function notRunJudgeRecord(agentId, reason, meta) {
  const identity = seatIdentity(agentId, meta);
  return {
    agent_id: identity.agent_id,
    display_name: identity.display_name,
    role: identity.role,
    seat: identity.seat,
    prompt_path: identity.prompt_path,
    prompt_version: identity.prompt_version,
    model: identity.model,
    status: "not_run",
    started_at: null,
    ended_at: null,
    duration_ms: null,
    raw_text: null,
    output: null,
    parse: null,
    failure: { kind: "not_run", message: reason },
    deviations: [],
    usage: null,
  };
}

async function fetchSeat(agentId, submissions, meta) {
  try {
    const response = await fetch("/api/live-seat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissions ? { agentId, submissions } : { agentId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { record: syntheticFailure(agentId, body.error || `HTTP ${response.status}`, meta), meta: null };
    }
    return { record: body.record, meta: body.meta };
  } catch (cause) {
    return { record: syntheticFailure(agentId, cause.message || "network error", meta), meta: null };
  }
}

function statusLabel(status) {
  if (status === "pending") return "waiting…";
  if (status === "ok") return "ok";
  if (status === "not_run") return "did not sit";
  return "failed";
}

function renderLiveProgress(progress, meta) {
  liveProgressEl.innerHTML = "";
  for (const [agentId, status] of progress) {
    const identity = seatIdentity(agentId, meta);
    const cls = status === "ok" ? "seat-ok" : status === "pending" ? "seat-pending" : "seat-failed";
    liveProgressEl.appendChild(
      el("li", { class: cls, text: `${identity.display_name} — ${statusLabel(status)}` }),
    );
  }
}

function sumField(rows, key) {
  return rows.reduce((total, row) => total + (row[key] || 0), 0);
}

/** Builds a run object in exactly the shape of a committed run file, so renderRun() needs no changes at all. */
function assembleLiveRun({ meta, advocates, judges, startedAt, endedAt, durationMs }) {
  const m = meta || fallbackMeta();
  const all = [...advocates, ...judges];
  const rows = all.map((record) => ({
    agent_id: record.agent_id,
    role: record.role,
    model: record.model,
    status: record.status,
    prompt_tokens: record.usage ? record.usage.prompt_tokens : null,
    completion_tokens: record.usage ? record.usage.completion_tokens : null,
    total_tokens: record.usage ? record.usage.total_tokens : null,
    cost_usd: record.usage ? record.usage.cost_usd : null,
  }));

  const totals = {
    prompt_tokens: sumField(rows, "prompt_tokens"),
    completion_tokens: sumField(rows, "completion_tokens"),
    total_tokens: sumField(rows, "total_tokens"),
    cost_usd: Number(rows.reduce((total, row) => total + (row.cost_usd || 0), 0).toFixed(8)),
    cost_is_partial: all.some((record) => record.status === "ok" && (record.usage ? record.usage.cost_usd : null) == null),
    pricing: m.provider.pricing,
    calls_ok: all.filter((record) => record.status === "ok").length,
    calls_failed: all.filter((record) => record.status !== "ok").length,
    budget_usd: m.budget_usd,
    budget_exceeded: false,
  };
  totals.budget_exceeded = totals.budget_usd !== null && totals.cost_usd > totals.budget_usd;

  const promptVersions = {};
  for (const record of all) promptVersions[record.agent_id] = record.prompt_version;

  const failures = all
    .filter((record) => record.status !== "ok")
    .map((record) => `${record.agent_id}: ${record.failure ? record.failure.kind : "unknown"} — ${record.failure ? record.failure.message : ""}`);

  const opinions = {};
  for (const record of judges) opinions[record.agent_id] = record;

  return {
    schema_version: 1,
    run: {
      id: `live-${startedAt.replace(/[:.]/g, "-")}`,
      case: m.case,
      mode: m.mode,
      label: m.label,
      config: m.config,
      provider: m.provider,
      shared_rules: m.shared_rules,
      prompt_versions: promptVersions,
      started_at: startedAt,
      ended_at: endedAt,
      duration_ms: durationMs,
      status: failures.length === 0 ? "complete" : "incomplete",
      failures,
    },
    advocates,
    opinions,
    usage: { calls: rows, totals },
  };
}

async function runLive() {
  liveBtn.disabled = true;
  liveStatusEl.textContent = "Starting live run — mode A, one model, seven seats…";

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  let meta = null;

  const progress = new Map();
  for (const agentId of [...ADVOCATE_IDS, ...JUDGE_IDS]) progress.set(agentId, "pending");
  renderLiveProgress(progress, meta);

  try {
    const advocateRecords = new Map();
    await Promise.all(
      ADVOCATE_IDS.map(async (agentId) => {
        const outcome = await fetchSeat(agentId, undefined, meta);
        if (outcome.meta && !meta) meta = outcome.meta;
        advocateRecords.set(agentId, outcome.record);
        progress.set(agentId, outcome.record.status);
        renderLiveProgress(progress, meta);
      }),
    );

    const orderedAdvocates = ADVOCATE_IDS.map((agentId) => advocateRecords.get(agentId));
    const failedAdvocates = orderedAdvocates.filter((record) => record.status !== "ok");

    const judgeRecords = new Map();
    if (failedAdvocates.length > 0) {
      // Mirrors orchestrator.ts exactly: all four arguments or the judges do
      // not sit. There is no path here that calls a judge on an incomplete set.
      const reason =
        `the judges did not sit: ${failedAdvocates.length} of ${orderedAdvocates.length} advocates ` +
        `failed (${failedAdvocates.map((record) => record.agent_id).join(", ")}), and the protocol ` +
        `has every judge read all four arguments`;
      for (const agentId of JUDGE_IDS) {
        judgeRecords.set(agentId, notRunJudgeRecord(agentId, reason, meta));
        progress.set(agentId, "not_run");
      }
      renderLiveProgress(progress, meta);
    } else {
      const submissions = orderedAdvocates.map((record) => ({
        agent_id: record.agent_id,
        raw_text: record.raw_text || "",
      }));
      await Promise.all(
        JUDGE_IDS.map(async (agentId) => {
          const outcome = await fetchSeat(agentId, submissions, meta);
          if (outcome.meta && !meta) meta = outcome.meta;
          judgeRecords.set(agentId, outcome.record);
          progress.set(agentId, outcome.record.status);
          renderLiveProgress(progress, meta);
        }),
      );
    }

    const endedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - t0);
    const run = assembleLiveRun({
      meta,
      advocates: orderedAdvocates,
      judges: JUDGE_IDS.map((agentId) => judgeRecords.get(agentId)),
      startedAt,
      endedAt,
      durationMs,
    });

    renderRun(run);
    result.insertBefore(
      el("div", {
        class: "notice",
        text:
          "This is a live run, rendered in your browser just now — it is not saved anywhere and is gone if " +
          "you reload this page. It is a demonstration of the pipeline, not a new source of record: because " +
          "each seat is one stateless serverless call, the judges here read advocate text relayed back by " +
          "this page rather than held server-side for the whole run. The committed runs in the archive above, " +
          "each produced by one process holding everything in memory end to end, remain the record.",
      }),
      result.firstChild,
    );

    liveStatusEl.textContent =
      run.run.status === "complete"
        ? `Live run complete in ${(durationMs / 1000).toFixed(1)}s.`
        : `Live run incomplete in ${(durationMs / 1000).toFixed(1)}s — see the run above; nothing was substituted for a seat that didn't return.`;
  } catch (cause) {
    liveStatusEl.textContent = `Live run failed unexpectedly: ${cause.message}`;
  } finally {
    liveBtn.disabled = false;
  }
}

liveBtn.addEventListener("click", runLive);

loadRunList().catch((cause) => {
  statusEl.textContent = `Could not load the list of runs: ${cause.message}`;
});
