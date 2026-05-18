#!/usr/bin/env node
// One-shot schema runner. Splits SQL on GO batch separator and executes each batch.
// Usage: node scripts/run-schema.js [path/to/file.sql]

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const sql = require("mssql");

const file = process.argv[2] || path.join(__dirname, "..", "server", "sql", "001_init.sql");
const text = fs.readFileSync(file, "utf8");
const batches = text
  .split(/^\s*GO\s*$/im)
  .map((b) => b.trim())
  .filter(Boolean);

(async () => {
  // Start on master so CREATE DATABASE works, then jump to target DB for the rest.
  const baseConfig = {
    server: process.env.MSSQL_SERVER,
    port: Number(process.env.MSSQL_PORT) || 1433,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    options: { encrypt: process.env.MSSQL_ENCRYPT === "true", trustServerCertificate: true },
  };

  let pool = await new sql.ConnectionPool({ ...baseConfig, database: "master" }).connect();
  console.log("[schema] connected to master");

  let switched = false;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const preview = batch.slice(0, 80).replace(/\s+/g, " ");
    console.log(`[schema] batch ${i + 1}/${batches.length}: ${preview}…`);
    try {
      await pool.request().batch(batch);
    } catch (err) {
      console.error(`[schema] batch ${i + 1} failed:`, err.message);
      process.exit(1);
    }
    if (!switched && /^USE\s+AIFramework/i.test(batch)) {
      await pool.close();
      pool = await new sql.ConnectionPool({
        ...baseConfig,
        database: process.env.MSSQL_DATABASE || "AIFramework",
      }).connect();
      switched = true;
      console.log("[schema] switched to AIFramework");
    }
  }
  await pool.close();
  console.log("[schema] done");
  process.exit(0);
})().catch((e) => {
  console.error("[schema] fatal:", e);
  process.exit(1);
});
