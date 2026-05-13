// 3-Year AI Roadmap section. Loads /data/roadmap.json.
// Year 1: 12 monthly issue cards (full detail). Years 2 + 3: high-level
// strategic overview — pillars, outcomes, and theme chips. AI tech moves
// quickly, so we keep monthly cadence only for Year 1.

const PANEL_ID = "roadmap-panel";
const TABS_ID = "roadmap-tabs";
// Resolve relative to document base so the site works on GitHub Pages project
// subpaths (e.g. /AIFramework/) as well as root deployments.
const DATA_URL =
  (typeof document !== "undefined" && document.documentElement.getAttribute("data-base")
    ? document.documentElement.getAttribute("data-base")
    : "") + "data/roadmap.json";

const OVERVIEWS = {
  2: {
    vision:
      "Year 2 moves from individual skill to departmental playbooks. Each function — Finance, HR, Sales, Service, Operations, Procurement, Leadership, Marketing — owns a documented AI playbook with safe defaults, approved tools, and shared prompts.",
    pillars: [
      {
        title: "Function-specific playbooks",
        body: "Every department documents two or three AI-powered workflows with approved tools and review checklists.",
      },
      {
        title: "Embedded into existing tools",
        body: "AI shows up where work already happens — email, meetings, spreadsheets, CRM — instead of yet another tab.",
      },
      {
        title: "Voice, meetings, and shared knowledge",
        body: "Transcribe, summarise, and route meeting outcomes into action so decisions don't get lost.",
      },
    ],
    outcomes: [
      "Each department lands two to three documented AI playbooks.",
      "Meeting time recovered through transcription, summaries, and follow-up automation.",
      "Cross-team prompt library curated by department champions.",
      "Year 2 showcase event presenting real wins to leadership.",
    ],
  },
  3: {
    vision:
      "Year 3 scales individual and team wins into a portfolio. We measure impact, govern risk, and decide where to build, buy, or partner. AI graduates from internal productivity tool to customer-facing capability.",
    pillars: [
      {
        title: "Custom GPTs, copilots, and automation",
        body: "Teams build internal assistants and connect AI to workflow automation — trigger to outcome, not just chat.",
      },
      {
        title: "Measurable impact and governance",
        body: "Track time saved, quality lifted, and ROI. Risk, audit, and compliance scale with adoption.",
      },
      {
        title: "Customer-facing AI and strategy",
        body: "AI features ship to customers. Build-vs-buy decisions move from gut to portfolio-level strategy.",
      },
    ],
    outcomes: [
      "Portfolio of internal copilots and document-intelligence pipelines in production.",
      "Quarterly ROI report covering time, quality, and revenue impact.",
      "Risk and governance framework signed off by legal and IT.",
      "Customer-facing AI features live in at least one product line.",
    ],
  },
};

const monthName = (m) =>
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ||
  `M${m}`;

const escape = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function cardHTML(issue) {
  const tag = issue.workshop ? "Workshop" : "Issue";
  const why = (issue.why || []).map((w) => `<li>${escape(w)}</li>`).join("");
  return `
    <article class="roadmap-card${issue.workshop ? " is-workshop" : ""}" data-roadmap-card="${issue.issue}">
      <header class="roadmap-card-head">
        <div class="roadmap-card-meta">
          <span class="roadmap-card-month">${escape(monthName(issue.month))} · Y${issue.year}</span>
          <span class="roadmap-card-kind">${tag}</span>
        </div>
        <div class="roadmap-card-kicker">${escape(issue.kicker || "")}</div>
        <h3 class="roadmap-card-title">${escape(issue.title || "")}</h3>
        <p class="roadmap-card-subtitle">${escape(issue.subtitle || "")}</p>
      </header>
      <p class="roadmap-card-benefit"><strong>Outcome:</strong> ${escape(issue.benefit || "")}</p>
      <details class="roadmap-card-details">
        <summary>Show prompt &amp; challenge</summary>
        ${why ? `<div class="roadmap-card-block"><h4>What you'll learn</h4><ul>${why}</ul></div>` : ""}
        ${
          issue.prompt
            ? `<div class="roadmap-card-block"><h4>Try this prompt</h4><pre class="roadmap-card-prompt">${escape(issue.prompt)}</pre></div>`
            : ""
        }
        ${
          issue.challenge
            ? `<div class="roadmap-card-block"><h4>This month's challenge</h4><p>${escape(issue.challenge)}</p></div>`
            : ""
        }
        ${
          issue.card04Title
            ? `<div class="roadmap-card-safety"><strong>${escape(issue.card04Title)}.</strong> ${escape(issue.card04Text || "")}</div>`
            : ""
        }
      </details>
    </article>
  `;
}

function overviewHTML(year, issues) {
  const data = OVERVIEWS[Number(year)];
  if (!data) return "";
  const yearIssues = issues.filter((i) => Number(i.year) === Number(year));
  const pillars = data.pillars
    .map(
      (p) =>
        `<article class="roadmap-pillar"><h4>${escape(p.title)}</h4><p>${escape(p.body)}</p></article>`,
    )
    .join("");
  const outcomes = data.outcomes.map((o) => `<li>${escape(o)}</li>`).join("");
  const chips = yearIssues
    .map(
      (i) =>
        `<span class="roadmap-chip${i.workshop ? " is-workshop" : ""}" title="${escape(i.title || "")}">${escape(i.kicker || "")}</span>`,
    )
    .join("");
  return `
    <div class="roadmap-overview">
      <div class="roadmap-overview-head">
        <div class="roadmap-overview-kicker">Year ${escape(year)} · Strategic overview</div>
        <p class="roadmap-overview-vision">${escape(data.vision)}</p>
      </div>
      <div class="roadmap-pillars">${pillars}</div>
      <div class="roadmap-overview-block">
        <h4>Year ${escape(year)} outcomes</h4>
        <ul class="roadmap-outcomes">${outcomes}</ul>
      </div>
      <div class="roadmap-overview-block">
        <h4>Themes we'll explore</h4>
        <p class="roadmap-overview-note">
          High level only — exact monthly cadence will be set later, since AI tooling will keep
          shifting between now and then.
        </p>
        <div class="roadmap-chips">${chips}</div>
      </div>
    </div>
  `;
}

function renderYear(panel, issues, year) {
  if (Number(year) === 1) {
    panel.classList.remove("is-overview");
    const filtered = issues.filter((i) => Number(i.year) === 1);
    panel.innerHTML = filtered.map(cardHTML).join("");
    return;
  }
  panel.classList.add("is-overview");
  panel.innerHTML = overviewHTML(year, issues);
}

function wireTabs(tabsEl, panel, issues) {
  const tabs = Array.from(tabsEl.querySelectorAll(".roadmap-tab"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      const idx = tabs.indexOf(tab);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        activate(tabs[(idx + 1) % tabs.length], true);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        activate(tabs[(idx - 1 + tabs.length) % tabs.length], true);
      } else if (event.key === "Home") {
        event.preventDefault();
        activate(tabs[0], true);
      } else if (event.key === "End") {
        event.preventDefault();
        activate(tabs[tabs.length - 1], true);
      }
    });
  });

  function activate(tab, focus = false) {
    tabs.forEach((t) => {
      const isActive = t === tab;
      t.classList.toggle("is-active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
      t.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    renderYear(panel, issues, tab.dataset.roadmapYear);
    if (focus) tab.focus();
  }
}

async function init() {
  const panel = document.getElementById(PANEL_ID);
  const tabs = document.getElementById(TABS_ID);
  if (!panel || !tabs) return;

  panel.innerHTML = '<p class="roadmap-loading">Loading roadmap…</p>';

  let issues;
  try {
    const res = await fetch(DATA_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    issues = await res.json();
  } catch (err) {
    panel.innerHTML =
      '<p class="roadmap-error">Roadmap data is temporarily unavailable. Refresh to try again.</p>';
    console.warn("roadmap load failed", err);
    return;
  }

  const active = tabs.querySelector(".roadmap-tab.is-active") || tabs.querySelector(".roadmap-tab");
  renderYear(panel, issues, active?.dataset.roadmapYear || "1");
  wireTabs(tabs, panel, issues);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
