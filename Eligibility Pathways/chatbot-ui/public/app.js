// Eligibility Pathways/chatbot-ui/public/app.js

// -------------------------
// Core DOM refs (Chat)
// -------------------------
const form = document.getElementById("chat-form");
const queryInput = document.getElementById("query");
const messages = document.getElementById("messages");
const status = document.getElementById("status");
const chips = document.querySelectorAll(".chip");
const debugLog = document.getElementById("debug-log");
const clearLog = document.getElementById("clear-log");
const modeSelect = document.getElementById("modeSelect");

const fields = {
  householdId: document.getElementById("householdId"),
  familyName: document.getElementById("familyName"), // NEW
  personName: document.getElementById("personName"),
  programName: document.getElementById("programName"),
  personId: document.getElementById("personId"),
  programId: document.getElementById("programId"),
  personSsn: document.getElementById("personSsn")
};

const CANNED_PROMPTS = [
  {
    label: "Summarize eligibility outcomes",
    text: "Summarize eligibility outcomes for this household, per person, including evaluated, assigned, and selected coverage."
  },
  {
    label: "Why was the selected coverage chosen?",
    text: "Explain why the selected class of assistance was chosen for each person. Include rule trace evidence for the selected option."
  },
  {
    label: "Why was an option not eligible?",
    text: "Explain why any options were disqualified (income, non-financial, blanket, or other flags). Include trace evidence tied to those flags."
  },
  {
    label: "Show trace evidence for selected decision",
    text: "Show the top rule trace entries that directly contributed to the selected coverage decision for each person."
  },
  {
    label: "Income & FPL explanation",
    text: "Explain how income and FPL affected the outcome for this household. Reference eligibility notes and relevant trace evidence."
  },
  {
    label: "Pathways / work requirement explanation",
    text: "Explain whether Pathways was evaluated and whether qualifying activity/work requirements affected the decision. Include trace evidence."
  },
  {
    label: "Institutional care explanation",
    text: "Explain whether institutional stay or nursing home criteria drove the decision. Include trace evidence."
  },
  {
    label: "Audit-ready summary",
    text: "Provide a short audit-ready summary with selected coverage and 3 trace citations per person in the format Rulesheet:Rule."
  }
];

// -------------------------
// Core helpers (Chat)
// -------------------------
function addMessage(role, text, citations, pending) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}${pending ? " pending" : ""}`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = role === "user" ? "You" : "Assistant";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);

  if (citations && citations.length) {
    const citationsList = document.createElement("ul");
    citationsList.className = "citations";
    citations.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.citationLabel || item.citationId || "Citation";
      citationsList.appendChild(li);
    });
    wrapper.appendChild(citationsList);
  }

  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;

  return { wrapper, bubble };
}

function logDebug(label, payload) {
  const time = new Date().toLocaleTimeString();
  const message = payload ? `${label}: ${JSON.stringify(payload, null, 2)}` : label;
  const line = `[${time}] ${message}`;
  console.log(line);

  if (debugLog) {
    const lines = debugLog.textContent ? debugLog.textContent.split("\n") : [];
    const next = lines.concat(line).slice(-120);
    debugLog.textContent = next.join("\n");
    debugLog.scrollTop = debugLog.scrollHeight;
  }
}

function collectPayload() {
  const payload = {};
  const query = queryInput.value.trim();
  if (query) payload.query = query;

  const uiMode = modeSelect ? modeSelect.value : "narrative";

  // what we tell MarkLogic service
  let requestMode = "summary";
  let forceVerbatim = false;

  if (uiMode === "trace") requestMode = "trace";
  if (uiMode === "verbatim") forceVerbatim = true;

  payload.mode = requestMode;
  payload.verbatim = forceVerbatim;

  Object.entries(fields).forEach(([key, input]) => {
    if (input && input.value.trim()) payload[key] = input.value.trim();
  });

  return payload;
}

function renderPromptButtons() {
  const container = document.getElementById("promptButtons");
  if (!container) return;

  container.innerHTML = "";
  CANNED_PROMPTS.forEach((prompt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = prompt.label;
    btn.addEventListener("click", () => {
      queryInput.value = prompt.text;
      queryInput.focus();
    });
    container.appendChild(btn);
  });
}

function formatFilterSummary(payload) {
  const parts = [];
  if (payload.householdId) parts.push(`household ${payload.householdId}`);
  if (payload.familyName) parts.push(`family ${payload.familyName}`);
  if (payload.personName) parts.push(`person ${payload.personName}`);
  if (payload.personId) parts.push(`personId ${payload.personId}`);
  if (payload.personSsn) parts.push(`personSsn ${payload.personSsn}`);
  if (payload.programName) parts.push(`program ${payload.programName}`);
  if (payload.programId) parts.push(`programId ${payload.programId}`);
  return parts.length ? `Trace lookup: ${parts.join(", ")}` : "";
}

async function sendMessage(payload) {
  logDebug("request", payload);
  if (status) status.textContent = "Sending query...";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  logDebug("response", { status: response.status, body: raw.slice(0, 2000) });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { output: raw };
  }

  if (!response.ok) {
    const errorText =
      data.error || data.detail || data.output || `Request failed (${response.status}).`;
    const err = new Error(errorText);
    err.debug = { status: response.status, body: raw };
    // include citations if backend provided them
    err.citations = data.citations || [];
    throw err;
  }

  return data;
}

// -------------------------
// Chat wiring
// -------------------------
renderPromptButtons();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = collectPayload();
  const hasFilters = Object.keys(fields).some((key) => payload[key]);

  if (!payload.query && !hasFilters) {
    addMessage("assistant", "Enter a query or provide filters first.", [], false);
    return;
  }

  if (payload.query) addMessage("user", payload.query, [], false);
  else addMessage("user", formatFilterSummary(payload), [], false);

  const pending = addMessage("assistant", "Checking eligibility output...", [], true);

  try {
    const data = await sendMessage(payload);

    pending.wrapper.classList.remove("pending");
    pending.bubble.textContent =
      data.output || data.message || data.error || data.detail || "No response text.";

    // ✅ render citations under the assistant message
    const citations = Array.isArray(data.citations) ? data.citations : [];
    if (citations.length) {
      // rebuild the message so citations show cleanly
      const assistantText = pending.bubble.textContent;
      pending.wrapper.remove();
      addMessage("assistant", assistantText, citations, false);
    }

    if (status) status.textContent = "Response received.";
  } catch (err) {
    logDebug("error", err.debug || { message: err.message });

    pending.wrapper.classList.remove("pending");
    pending.bubble.textContent = err.message || "Request failed.";

    // show citations if present even on error (OpenAI failure but MarkLogic citations returned)
    const citations = Array.isArray(err.citations) ? err.citations : [];
    if (citations.length) {
      const assistantText = pending.bubble.textContent;
      pending.wrapper.remove();
      addMessage("assistant", assistantText, citations, false);
    }

    if (status) status.textContent = "There was an error. Check the server logs.";
  }

  if (payload.query) queryInput.value = "";
});

queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    queryInput.value = chip.dataset.query || "";
    form.requestSubmit();
  });
});

if (clearLog) {
  clearLog.addEventListener("click", () => {
    if (debugLog) debugLog.textContent = "";
  });
}

// -------------------------
// Analytics (Tab + Auto-load)
// -------------------------
const tabChat = document.getElementById("tabChat");
const tabAnalytics = document.getElementById("tabAnalytics");
const chatTab = document.getElementById("chatTab");
const analyticsTab = document.getElementById("analyticsTab");

const selectedCoaList = document.getElementById("selectedCoaList");
const ineligibilityFlagsList = document.getElementById("ineligibilityFlagsList");
const examplesHeader = document.getElementById("examplesHeader");
const examplesList = document.getElementById("examplesList");
const analyticsStatus = document.getElementById("analyticsStatus");

let analyticsLoaded = false;

function stripPrefixKeys(row, prefix) {
  const out = {};
  Object.keys(row || {}).forEach((k) => {
    const short = k.startsWith(prefix) ? k.slice(prefix.length) : k;
    out[short] = row[k];
  });
  return out;
}

async function fetchJson(url) {
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(text);
  return JSON.parse(text);
}

function renderTable(container, rows, columns) {
  container.innerHTML = "";
  if (!rows || !rows.length) {
    container.textContent = "No data.";
    return;
  }

  const table = document.createElement("table");
  table.className = "analytics-table";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  columns.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c.label;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((c) => {
      const td = document.createElement("td");
      const v = row[c.key];
      td.textContent = v !== undefined && v !== null ? String(v) : "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderExamplesTable(exRows) {
  examplesList.innerHTML = "";
  if (!exRows || !exRows.length) {
    examplesList.textContent = "No examples found.";
    return;
  }

  const table = document.createElement("table");
  table.className = "analytics-table";

  const cols = [
    { key: "householdId", label: "Household" },
    { key: "familyName", label: "Family" },
    { key: "personFirst", label: "First" },
    { key: "personLast", label: "Last" },
    { key: "policyKey", label: "PolicyKey" },
    { key: "name", label: "Selected COA" }
  ];

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c.label;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  exRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.title = "Click to open trace explanation in chat";

    cols.forEach((c) => {
      const td = document.createElement("td");
      const v = row[c.key];
      td.textContent = v !== undefined && v !== null ? String(v) : "";
      tr.appendChild(td);
    });

    tr.addEventListener("click", () => {
      const hh = row.householdId;
      if (!hh) return;

      // Jump to chat tab
      setActiveTab("chat");

      // Trace mode + filter + question
      if (modeSelect) modeSelect.value = "trace";
      if (fields.householdId) fields.householdId.value = String(hh);

      queryInput.value =
        `Why was "${row.name}" selected for household ${hh}? ` +
        `Include key rule trace evidence (rulesheet and rule number) and the decisive eligibility flags.`;

      form.requestSubmit();
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  examplesList.appendChild(table);
}

async function loadAnalyticsTab() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  if (analyticsStatus) analyticsStatus.textContent = "Loading analytics...";

  const [selected, flags] = await Promise.all([
    fetchJson("/api/analytics/selected-coa"),
    fetchJson("/api/analytics/ineligibility-flags")
  ]);

  const selectedRows = selected.rows || [];
  const flagRows = flags.rows || [];

  if (selectedCoaList) selectedCoaList.innerHTML = "";
  if (ineligibilityFlagsList) ineligibilityFlagsList.innerHTML = "";
  if (examplesList) examplesList.innerHTML = "";
  if (examplesHeader) examplesHeader.style.display = "none";

  if (!selectedCoaList) return;

  if (!selectedRows.length) {
    selectedCoaList.textContent = "No data.";
  } else {
    let max = 1;
    selectedRows.forEach((r) => {
      max = Math.max(max, Number(r.count || 0));
    });

    selectedRows.forEach((r) => {
      const name = r.name;
      const count = Number(r.count || 0);

      const row = document.createElement("div");
      row.className = "bar-row";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bar-btn";
      btn.textContent = name;

      const barWrap = document.createElement("div");
      barWrap.className = "bar-wrap";

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = `${Math.round((count / max) * 100)}%`;

      const value = document.createElement("div");
      value.className = "bar-value";
      value.textContent = String(count);

      barWrap.appendChild(bar);
      row.appendChild(btn);
      row.appendChild(barWrap);
      row.appendChild(value);

      btn.addEventListener("click", async () => {
        const ex = await fetchJson(`/api/analytics/examples?name=${encodeURIComponent(name)}&limit=10`);
        const exRowsRaw = ex.rows || [];
        const exRows = exRowsRaw.map((r2) => stripPrefixKeys(r2, "eligibility.coa."));

        if (examplesHeader) {
          examplesHeader.style.display = "block";
          examplesHeader.textContent = `Examples: ${name}`;
        }
        renderExamplesTable(exRows);
      });

      selectedCoaList.appendChild(row);
    });
  }

  if (ineligibilityFlagsList) {
    renderTable(ineligibilityFlagsList, flagRows, [
      { key: "attributeName", label: "Flag" },
      { key: "newValue", label: "Value" },
      { key: "count", label: "Count" }
    ]);
  }

  if (analyticsStatus) analyticsStatus.textContent = "Loaded.";
}

function setActiveTab(which) {
  const isAnalytics = which === "analytics";

  if (tabChat) tabChat.classList.toggle("active", !isAnalytics);
  if (tabAnalytics) tabAnalytics.classList.toggle("active", isAnalytics);

  if (chatTab) chatTab.classList.toggle("active", !isAnalytics);
  if (analyticsTab) analyticsTab.classList.toggle("active", isAnalytics);

  if (isAnalytics) {
    loadAnalyticsTab().catch((e) => {
      console.error(e);
      if (analyticsStatus) analyticsStatus.textContent = "Failed to load analytics.";
      alert("Analytics load failed: " + e.message);
    });
  }
}

if (tabChat) tabChat.addEventListener("click", () => setActiveTab("chat"));
if (tabAnalytics) tabAnalytics.addEventListener("click", () => setActiveTab("analytics"));
