#!/usr/bin/env node
// Build Goldbell AI Readiness Newsletter — 3-year plan PDF (36 issues).
// Renders HTML in headless Chromium (via @playwright/test) and prints A4 PDF.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "issues.json"), "utf8"),
);
const OUT_PATH =
  process.argv[2] ||
  path.join(
    "/Users/eliyazar/Documents/MX Project/GARP - AI Readiness Program",
    "Goldbell_AI_Readiness_Newsletter_3Y.pdf",
  );

const pad = (n) => String(n).padStart(2, "0");
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function orbitSvg() {
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="none" stroke="#f5a623" stroke-width="1.5" opacity="0.95">
      <ellipse cx="120" cy="120" rx="106" ry="38" />
      <ellipse cx="120" cy="120" rx="96" ry="60" transform="rotate(-22 120 120)" />
      <ellipse cx="120" cy="120" rx="96" ry="60" transform="rotate(22 120 120)" />
    </g>
    <g fill="#f5a623">
      <circle cx="226" cy="120" r="4" />
      <circle cx="38" cy="138" r="3.5" />
      <circle cx="178" cy="64" r="3" />
    </g>
    <circle cx="120" cy="120" r="44" fill="#f5a623" />
    <text x="120" y="134" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
          font-size="36" font-weight="900" fill="#1c1c1e">AI</text>
  </svg>`;
}

function logoMark() {
  return `<div class="brand">
    <div class="brand-mark"></div>
    <div class="brand-word">GOLDBELL<br/><span>GROUP</span></div>
  </div>`;
}

function coverPage() {
  return `<section class="page cover">
    <div class="cover-band"></div>
    ${logoMark()}
    <div class="cover-eyebrow">AI READINESS PROGRAM · GOLDBELL GROUP · FOR INTERNAL USE</div>
    <h1 class="cover-title">AI Readiness<br/>Newsletter</h1>
    <div class="cover-subtitle">A 3-year program for every Goldbell employee. 36 issues. Year 1 foundations,
      Year 2 department depth, Year 3 automation, governance, and scale.</div>
    <div class="cover-orbit">${orbitSvg()}</div>
    <div class="cover-pills">
      <div class="pill"><div class="pill-num">36</div><div class="pill-lbl">ISSUES</div></div>
      <div class="pill"><div class="pill-num">3</div><div class="pill-lbl">YEAR PROGRAM</div></div>
      <div class="pill"><div class="pill-num">12</div><div class="pill-lbl">LIVE WORKSHOPS</div></div>
    </div>
    <div class="cover-motto">PRACTICAL · RESPONSIBLE · REPEATABLE</div>
    <div class="cover-foot">Mobilising Singapore's economy, now &amp; beyond.</div>
  </section>`;
}

function yearDividerPage(year, title, blurb) {
  return `<section class="page year-divider">
    ${logoMark()}
    <div class="cover-eyebrow">YEAR ${year} OF 3 · GOLDBELL AI READINESS</div>
    <h1 class="cover-title">${esc(title)}</h1>
    <div class="cover-subtitle">${esc(blurb)}</div>
    <div class="cover-orbit small">${orbitSvg()}</div>
    <div class="cover-pills">
      <div class="pill"><div class="pill-num">12</div><div class="pill-lbl">ISSUES</div></div>
      <div class="pill"><div class="pill-num">4</div><div class="pill-lbl">WORKSHOPS</div></div>
      <div class="pill"><div class="pill-num">YEAR ${year}</div><div class="pill-lbl">PROGRAM</div></div>
    </div>
    <div class="cover-motto">PRACTICAL · RESPONSIBLE · REPEATABLE</div>
  </section>`;
}

function issuePage(it) {
  const monthBadge = `MONTH ${pad(it.month)} / 12`;
  const yearBadge = `YEAR ${it.year}`;
  const issueOf36 = `ISSUE ${pad(it.issue)} OF 36`;
  const c4 = it.workshop ? "hands-on" : "safety";
  const c4Label = it.workshop ? "04 · HANDS-ON SESSION" : "04 · SAFETY REMINDER";
  const bullets = it.why
    .map((b, i) => `<li><span class="num">${i + 1}</span><span>${esc(b)}</span></li>`)
    .join("");

  return `<section class="page issue">
    <header class="topbar">
      ${logoMark()}
      <div class="tagline">Mobilising Singapore's economy, now &amp; beyond.</div>
      <div class="issue-badge">
        <div class="issue-label">ISSUE</div>
        <div class="issue-month">${monthBadge}</div>
      </div>
    </header>
    <div class="meta-strip">AI READINESS MONTHLY · GOLDBELL GROUP · YEAR ${it.year} PROGRAM · ${issueOf36} · FOR INTERNAL USE</div>

    <div class="hero">
      <div class="hero-text">
        <div class="kicker">${esc(it.kicker)}</div>
        <h1 class="hero-title">${esc(it.title)}</h1>
        <p class="hero-sub">${esc(it.subtitle)}</p>
        <div class="chips">
          <div class="chip"><div class="chip-num">12</div><div class="chip-lbl">ISSUES</div></div>
          <div class="chip"><div class="chip-num">${yearBadge}</div><div class="chip-lbl">PROGRAM</div></div>
          <div class="chip"><div class="chip-num">LIVE</div><div class="chip-lbl">WORKSHOPS</div></div>
        </div>
      </div>
      <div class="hero-orbit">${orbitSvg()}</div>
      <div class="hero-motto">PRACTICAL · RESPONSIBLE · REPEATABLE</div>
    </div>

    <div class="benefit">
      <div class="benefit-label">THIS MONTH'S BENEFIT</div>
      <div class="benefit-text">${esc(it.benefit)}</div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-tag">01 · WHY IT MATTERS</div>
        <h3 class="card-title">Why it matters</h3>
        <ol class="why-list">${bullets}</ol>
        <div class="card-footer">
          <span class="card-footer-label">OUTCOMES</span>
          <span>Confidence · Better drafts · Faster decisions</span>
        </div>
      </div>

      <div class="card">
        <div class="card-tag">02 · TRY THIS PROMPT</div>
        <h3 class="card-title">Try this prompt</h3>
        <blockquote class="prompt">
          <span class="quote-mark">&ldquo;</span>
          ${esc(it.prompt)}
        </blockquote>
        <div class="card-footer">
          <span class="card-footer-label">TIP</span>
          <span>Replace the bracketed prompt details with your own context.</span>
        </div>
      </div>

      <div class="card narrow">
        <div class="card-tag">03 · 10-MINUTE CHALLENGE</div>
        <h3 class="card-title">10-minute challenge</h3>
        <p class="card-text">${esc(it.challenge)}</p>
        <div class="cta">→ TRY THIS WEEK</div>
      </div>

      <div class="card narrow card-${c4}">
        <div class="card-tag">${c4Label}</div>
        <h3 class="card-title">${esc(it.card04Title)}</h3>
        <p class="card-text">${esc(it.card04Text)}</p>
        <div class="cta">${esc(it.card04Cta)}</div>
      </div>
    </div>
  </section>`;
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --cream: #f5f0eb;
    --cream-2: #fbf5e8;
    --ink: #1c1c1e;
    --ink-2: #2a2a2c;
    --muted: #6b7280;
    --border: #e8e0d8;
    --surface: #ffffff;
    --gold: #f5a623;
    --gold-dark: #d48e1a;
    --gold-soft: #fdf3e1;
  }
  html, body { font-family: 'Inter', system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: var(--ink); background: var(--cream); -webkit-print-color-adjust: exact;
    print-color-adjust: exact; }
  @page { size: A4; margin: 0; }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 12mm 12mm;
    background: var(--cream);
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .page:last-child { page-break-after: auto; }

  /* Brand mark */
  .brand { display: flex; align-items: center; gap: 8px; }
  .brand-mark {
    width: 22px; height: 22px; border-radius: 4px; background: #c41e1e;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
  .brand-word {
    font-weight: 900; font-size: 9px; letter-spacing: 0.04em; line-height: 1.05;
    color: var(--ink);
  }
  .brand-word span { font-size: 7px; letter-spacing: 0.06em; color: var(--ink-2); }

  /* Issue top bar */
  .topbar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .tagline { color: var(--muted); font-size: 10px; }
  .issue-badge {
    background: #19191b;
    color: #fff;
    padding: 6px 14px;
    border-radius: 4px;
    border-left: 3px solid var(--gold);
    text-align: right;
    min-width: 110px;
  }
  .issue-label { font-size: 7.5px; letter-spacing: 0.18em; color: var(--gold); font-weight: 700; }
  .issue-month { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; }

  .meta-strip {
    text-align: center;
    font-size: 8.5px;
    letter-spacing: 0.12em;
    color: var(--ink-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
    font-weight: 600;
  }

  /* Hero */
  .hero {
    position: relative;
    background: #19191b;
    color: #fff;
    border-radius: 14px;
    padding: 22px 26px 26px;
    overflow: hidden;
    min-height: 140px;
    background-image:
      radial-gradient(circle at 88% 70%, rgba(245,166,35,0.08) 0%, transparent 40%),
      repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 4px);
  }
  .hero-text { position: relative; z-index: 2; max-width: 64%; }
  .kicker {
    font-size: 8.5px; letter-spacing: 0.16em; font-weight: 700; color: var(--gold);
    text-transform: uppercase; padding-bottom: 4px; margin-bottom: 12px;
    border-bottom: 2px solid var(--gold); display: inline-block;
  }
  .hero-title {
    font-size: 32px; line-height: 1.05; font-weight: 900;
    letter-spacing: -0.02em; margin-bottom: 8px;
  }
  .hero-sub { font-size: 10.5px; line-height: 1.55; color: #d9d4cb; max-width: 95%; margin-bottom: 14px; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .chip {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(245,166,35,0.4);
    border-radius: 4px;
    padding: 5px 9px;
    min-width: 64px;
  }
  .chip-num { color: var(--gold); font-weight: 800; font-size: 11px; letter-spacing: 0.04em; }
  .chip-lbl { color: #cfc9bd; font-size: 7px; letter-spacing: 0.16em; font-weight: 700; }

  .hero-orbit {
    position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
    width: 130px; height: 130px; z-index: 1;
  }
  .hero-orbit svg { width: 100%; height: 100%; }

  .hero-motto {
    position: absolute; right: 22px; bottom: 14px;
    font-size: 8px; letter-spacing: 0.18em; color: var(--gold); font-weight: 700; z-index: 2;
  }

  /* Benefit band */
  .benefit {
    background: var(--cream-2);
    border-left: 4px solid var(--gold);
    border-top: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 14px;
  }
  .benefit-label {
    font-size: 7.5px; letter-spacing: 0.16em; color: var(--gold-dark);
    font-weight: 700; margin-bottom: 4px;
  }
  .benefit-text { font-size: 12px; font-weight: 700; color: var(--ink); }

  /* Cards */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    flex: 1;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    overflow: hidden;
    min-height: 0;
  }
  .card::before {
    content: ""; position: absolute; top: 0; left: 16px; right: 16px;
    height: 2px; background: var(--gold); border-radius: 0 0 2px 2px;
  }
  .card-tag {
    font-size: 7px; letter-spacing: 0.18em; color: var(--gold-dark); font-weight: 800;
    text-transform: uppercase;
  }
  .card-title { font-size: 14px; font-weight: 800; color: var(--ink); margin-bottom: 2px; }
  .why-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .why-list li {
    display: grid; grid-template-columns: 18px 1fr; gap: 6px; align-items: flex-start;
    font-size: 9.5px; line-height: 1.5; color: var(--ink-2);
  }
  .why-list .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 999px;
    border: 1.5px solid var(--gold); color: var(--gold-dark);
    font-weight: 800; font-size: 8.5px;
  }
  .prompt {
    position: relative;
    background: var(--cream-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 14px 14px 22px;
    font-size: 9.5px;
    line-height: 1.55;
    color: var(--ink);
    min-height: 78px;
  }
  .prompt .quote-mark {
    position: absolute; top: 0; left: 6px;
    font-size: 24px; line-height: 1; color: var(--gold); font-weight: 900;
  }
  .card-text { font-size: 9.5px; line-height: 1.55; color: var(--ink-2); }
  .card-footer {
    margin-top: auto; padding-top: 8px;
    font-size: 7.5px; color: var(--muted);
    border-top: 1px solid var(--border);
    display: flex; gap: 6px; align-items: center;
  }
  .card-footer-label { color: var(--gold-dark); font-weight: 800; letter-spacing: 0.12em; }
  .cta {
    margin-top: auto;
    display: inline-block;
    width: max-content;
    padding: 5px 10px;
    border: 1px solid var(--gold);
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--gold-dark);
    background: var(--gold-soft);
  }
  .card.narrow { padding-bottom: 14px; }

  /* Cover + year divider */
  .cover, .year-divider {
    position: relative;
    padding: 22mm 16mm;
    justify-content: flex-start;
  }
  .cover-band {
    position: absolute; top: 0; left: 0; right: 0; height: 6mm;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    opacity: 0.7;
  }
  .cover .brand, .year-divider .brand { margin-bottom: 22mm; }
  .cover-eyebrow {
    font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
    color: var(--gold-dark); margin-bottom: 12mm;
  }
  .cover-title {
    font-size: 56px; line-height: 1.02; font-weight: 900;
    letter-spacing: -0.025em; color: var(--ink); margin-bottom: 8mm;
  }
  .cover-subtitle {
    font-size: 14px; line-height: 1.55; color: var(--ink-2); max-width: 150mm;
    margin-bottom: 14mm;
  }
  .cover-orbit {
    width: 70mm; height: 70mm; align-self: flex-end; margin-top: -6mm;
  }
  .cover-orbit.small { width: 46mm; height: 46mm; }
  .cover-pills {
    display: flex; gap: 10px; margin-top: 18mm;
  }
  .pill {
    background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--gold);
    border-radius: 4px; padding: 8px 14px; min-width: 90px;
  }
  .pill-num { color: var(--gold); font-weight: 800; font-size: 14px; }
  .pill-lbl { color: var(--ink-2); font-size: 8px; letter-spacing: 0.16em; font-weight: 700; }
  .cover-motto {
    margin-top: 8mm; font-size: 10px; letter-spacing: 0.2em;
    color: var(--gold-dark); font-weight: 700;
  }
  .cover-foot {
    position: absolute; bottom: 14mm; left: 16mm; right: 16mm;
    font-size: 9px; color: var(--muted); border-top: 1px solid var(--border);
    padding-top: 6px;
  }
`;

function buildHtml() {
  const cover = coverPage();
  const y1 = yearDividerPage(
    1,
    "Year 1 — Foundations",
    "Build shared AI literacy across Goldbell. Cover the basics, build prompt habits, identify use cases, and put first guardrails in place.",
  );
  const y2 = yearDividerPage(
    2,
    "Year 2 — Department depth",
    "Move from individual skills to team workflows. Each department builds its own AI playbook across HR, Finance, Sales, Service, Operations, Procurement, Leadership, and Marketing.",
  );
  const y3 = yearDividerPage(
    3,
    "Year 3 — Automation, governance, scale",
    "Move from team workflows to automated, measured, governed AI. Custom assistants, document intelligence, impact metrics, and group-wide strategy.",
  );

  const y1Issues = DATA.filter((i) => i.year === 1).map(issuePage).join("\n");
  const y2Issues = DATA.filter((i) => i.year === 2).map(issuePage).join("\n");
  const y3Issues = DATA.filter((i) => i.year === 3).map(issuePage).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Goldbell AI Readiness Newsletter — 3-Year Plan</title>
<style>${CSS}</style>
</head>
<body>
${cover}
${y1}
${y1Issues}
${y2}
${y2Issues}
${y3}
${y3Issues}
</body>
</html>`;
}

async function main() {
  const html = buildHtml();
  const tmpHtml = path.join(__dirname, "_build.html");
  fs.writeFileSync(tmpHtml, html, "utf8");
  console.log("[build] HTML draft:", tmpHtml);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + tmpHtml, { waitUntil: "networkidle" });
  await page.pdf({
    path: OUT_PATH,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  const stat = fs.statSync(OUT_PATH);
  console.log("[build] PDF written:", OUT_PATH, "(" + (stat.size / 1024).toFixed(1) + " KB)");
}

main().catch((err) => {
  console.error("[build] failed:", err);
  process.exit(1);
});
