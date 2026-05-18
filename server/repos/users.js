const { getPool, sql } = require("../db.js");

async function upsertUser({ oid, email, name }) {
  const pool = await getPool();
  try {
    await pool
      .request()
      .input("oid", sql.NVarChar(64), oid)
      .input("email", sql.NVarChar(256), email || "")
      .input("name", sql.NVarChar(256), name || null).query(`
        SET XACT_ABORT ON;
        IF EXISTS (SELECT 1 FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE userOid = @oid)
          UPDATE dbo.Users
          SET email = @email, displayName = @name, lastLoginAt = SYSUTCDATETIME()
          WHERE userOid = @oid;
        ELSE
          INSERT INTO dbo.Users (userOid, email, displayName) VALUES (@oid, @email, @name);
      `);
  } catch (err) {
    // 2627 / 2601: duplicate key on a concurrent insert — safe to ignore, row exists.
    if (err.number === 2627 || err.number === 2601) return;
    throw err;
  }
}

module.exports = { upsertUser };
