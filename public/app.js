// No framework, no build step. Fetches a committed run from the one
// serverless function (api/runs.ts) and renders it. Nothing here calls a
// model or touches the OpenRouter key — that key never reaches the browser.

const DEFAULT_RUN_ID = "2026-09-07T09-59-57-177Z"; // mode B, complete, three real opinions

const select = document.getElementById("run-select");
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const result = document.getElementById("result");

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

loadRunList().catch((cause) => {
  statusEl.textContent = `Could not load the list of runs: ${cause.message}`;
});
