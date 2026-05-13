#!/usr/bin/env node
/* global AbortController, TextDecoder, Buffer */

// Express server: serves dist/ + proxies /api/refine to OpenAI.
// Key stays server-side (OPENAI_API_KEY env var). Frontend never sees it.

require("dotenv").config();

const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");

const PORT = Number(process.env.PORT || 5173);
const DIST_DIR = path.join(__dirname, "..", "dist");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const PROMPT_ENGINEER_SYSTEM = [
  "You are an expert prompt engineer.",
  "You take a rough user instruction and rewrite it into a clear, structured prompt suitable for an LLM.",
  "Always apply these best practices:",
  "1. Give the model a specific role.",
  "2. State the task and success criteria clearly.",
  "3. Include relevant context, constraints, and audience.",
  "4. Specify the requested output format precisely.",
  "5. Use placeholders like [topic], [audience], [data] for anything the user must fill in.",
  "6. Keep the prompt concise but complete.",
  "Return ONLY the refined prompt as plain text. Do NOT add explanations, preambles, or markdown code fences.",
].join("\n");

const app = express();
// 25mb to accommodate base64-encoded attachments (images + docs).
app.use(express.json({ limit: "25mb" }));

// Light per-IP rate limit (memory-only, fine for single instance).
const rateBuckets = new Map();
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000; // per minute

function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }
  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  if (bucket.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: OPENAI_MODEL, keyConfigured: Boolean(OPENAI_KEY) });
});

app.post("/api/refine", rateLimit, async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: "Server missing OPENAI_API_KEY." });
  }

  const { rough, goal, tone, format, includeExamples, includeCot } = req.body || {};
  if (typeof rough !== "string" || !rough.trim()) {
    return res.status(400).json({ error: "Field 'rough' (string) is required." });
  }
  if (rough.length > 8000) {
    return res.status(400).json({ error: "'rough' too long (max 8000 chars)." });
  }

  const extras = [];
  if (includeExamples) extras.push("Include 1-2 short worked examples (few-shot).");
  if (includeCot)
    extras.push(
      "Instruct the model to think step-by-step internally before producing the final answer.",
    );

  const userMessage = [
    "ROUGH USER PROMPT:",
    rough.trim(),
    "",
    "REWRITE IT FOR THIS GOAL: " + (goal || "general"),
    "DESIRED TONE: " + (tone || "warm, professional, concise"),
    "OUTPUT FORMAT THE FINAL MODEL SHOULD RETURN: " +
      (format || "markdown with headings and bullets"),
    extras.length ? "ADDITIONAL TECHNIQUES: " + extras.join(" ") : "",
    "",
    "Return only the refined prompt itself.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const upstream = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_KEY,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          { role: "system", content: PROMPT_ENGINEER_SYSTEM },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!upstream.ok) {
      let detail = "";
      try {
        const errJson = await upstream.json();
        detail = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        detail = await upstream.text();
      }
      return res
        .status(upstream.status)
        .json({ error: "OpenAI " + upstream.status + ": " + (detail || "request failed") });
    }

    const data = await upstream.json();
    const refined = data?.choices?.[0]?.message?.content?.trim();
    if (!refined) {
      return res.status(502).json({ error: "Empty response from model." });
    }
    res.json({ refined });
  } catch (err) {
    console.error("[/api/refine]", err);
    res.status(500).json({ error: err.message || "Server error." });
  }
});

// POST /api/chat — SSE stream. Body: { systemPrompt, messages: [{role,content}] }.
// Emits raw text deltas as `data: {token}` events, ending with `data: [DONE]`.
app.post("/api/chat", rateLimit, async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: "Server missing OPENAI_API_KEY." });
  }
  const { systemPrompt, messages } = req.body || {};
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    return res.status(400).json({ error: "Field 'systemPrompt' (string) required." });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Field 'messages' (array) required." });
  }
  if (systemPrompt.length > 16000) {
    return res.status(400).json({ error: "'systemPrompt' too long (max 16000 chars)." });
  }
  // Content may be a string OR OpenAI multipart array:
  //   [{type:"text", text:"..."}, {type:"image_url", image_url:{url:"data:..."}}]
  const isValidContent = (c) => {
    if (typeof c === "string") return true;
    if (!Array.isArray(c)) return false;
    return c.every((part) => {
      if (!part || typeof part.type !== "string") return false;
      if (part.type === "text") return typeof part.text === "string";
      if (part.type === "image_url") {
        return part.image_url && typeof part.image_url.url === "string";
      }
      return false;
    });
  };
  const contentLen = (c) => {
    if (typeof c === "string") return c.length;
    if (!Array.isArray(c)) return 0;
    return c.reduce((n, p) => n + (p.type === "text" ? p.text?.length || 0 : 0), 0);
  };
  const cleaned = messages
    .filter((m) => m && isValidContent(m.content) && (m.role === "user" || m.role === "assistant"))
    .slice(-12); // keep last 12 turns for cost bound
  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from user." });
  }
  for (const m of cleaned) {
    if (contentLen(m.content) > 60000) {
      return res.status(400).json({ error: "Message text too long (max 60k chars)." });
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const sendDone = () => res.write(`data: [DONE]\n\n`);

  const controller = new AbortController();
  res.on("close", () => {
    controller.abort();
  });

  try {
    const upstream = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_KEY,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
        messages: [{ role: "system", content: systemPrompt.trim() }, ...cleaned],
      }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      send({
        error: "OpenAI " + upstream.status + ": " + (text.slice(0, 300) || "request failed"),
      });
      sendDone();
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          sendDone();
          return res.end();
        }
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) send({ token: delta });
        } catch {
          // ignore malformed chunk
        }
      }
    }
    sendDone();
    res.end();
  } catch (err) {
    if (err.name === "AbortError") return res.end();
    console.error("[/api/chat]", err);
    send({ error: err.message || "Server error." });
    sendDone();
    res.end();
  }
});

// POST /api/extract — extract text from PDF/Word/Excel/CSV/plain text.
// Body: { filename, mimeType, base64 }. Returns { text, kind, name }.
const MAX_EXTRACT_BYTES = 10 * 1024 * 1024; // 10MB raw file
const MAX_EXTRACT_TEXT = 200_000; // 200k chars returned (~50k tokens)

app.post("/api/extract", rateLimit, async (req, res) => {
  const { filename, mimeType, base64 } = req.body || {};
  if (typeof base64 !== "string" || !base64) {
    return res.status(400).json({ error: "Field 'base64' (string) required." });
  }
  if (typeof filename !== "string" || !filename) {
    return res.status(400).json({ error: "Field 'filename' (string) required." });
  }
  let buf;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64." });
  }
  if (buf.length > MAX_EXTRACT_BYTES) {
    return res.status(413).json({ error: "File exceeds 10MB cap." });
  }

  const name = filename.toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  try {
    let text = "";
    let kind = "text";

    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      kind = "pdf";
      const result = await pdfParse(buf);
      text = result.text || "";
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      kind = "docx";
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value || "";
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel" ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")
    ) {
      kind = "xlsx";
      const wb = xlsx.read(buf, { type: "buffer" });
      const parts = [];
      for (const sheetName of wb.SheetNames) {
        const csv = xlsx.utils.sheet_to_csv(wb.Sheets[sheetName]);
        parts.push("=== Sheet: " + sheetName + " ===\n" + csv);
      }
      text = parts.join("\n\n");
    } else if (mime === "text/csv" || name.endsWith(".csv")) {
      kind = "csv";
      text = buf.toString("utf8");
    } else if (
      mime.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".json") ||
      name.endsWith(".log")
    ) {
      kind = "text";
      text = buf.toString("utf8");
    } else {
      return res.status(415).json({ error: "Unsupported file type: " + (mime || filename) });
    }

    text = text.trim();
    let truncated = false;
    if (text.length > MAX_EXTRACT_TEXT) {
      text = text.slice(0, MAX_EXTRACT_TEXT) + "\n\n[…truncated]";
      truncated = true;
    }
    if (!text) {
      return res.status(422).json({ error: "No text could be extracted from " + filename });
    }
    res.json({ text, kind, name: filename, truncated });
  } catch (err) {
    console.error("[/api/extract]", err);
    res.status(500).json({ error: err.message || "Extract failed." });
  }
});

// Static frontend (post-build). Fallback to index.html for SPA-ish routing.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { extensions: ["html"] }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexFile = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    next();
  });
} else {
  console.warn("[server] dist/ not found — run `npm run build` first for static serving.");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] OpenAI key configured: ${Boolean(OPENAI_KEY)}, model: ${OPENAI_MODEL}`);
});
