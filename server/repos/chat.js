// Chat repository — every query MUST filter by userOid to enforce isolation.
const { getPool, sql } = require("../db.js");

async function createSession({ userOid, title, systemPrompt }) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("userOid", sql.NVarChar(64), userOid)
    .input("title", sql.NVarChar(200), title || "New chat")
    .input("systemPrompt", sql.NVarChar(sql.MAX), systemPrompt || null).query(`
      INSERT INTO dbo.ChatSessions (userOid, title, systemPrompt)
      OUTPUT INSERTED.sessionId, INSERTED.title, INSERTED.createdAt, INSERTED.updatedAt
      VALUES (@userOid, @title, @systemPrompt);
    `);
  return r.recordset[0];
}

async function listSessions(userOid) {
  const pool = await getPool();
  const r = await pool.request().input("userOid", sql.NVarChar(64), userOid).query(`
      SELECT TOP 100 sessionId, title, createdAt, updatedAt
      FROM dbo.ChatSessions
      WHERE userOid = @userOid AND isDeleted = 0
      ORDER BY updatedAt DESC;
    `);
  return r.recordset;
}

async function getSession({ sessionId, userOid }) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("sessionId", sql.UniqueIdentifier, sessionId)
    .input("userOid", sql.NVarChar(64), userOid).query(`
      SELECT sessionId, title, systemPrompt, createdAt, updatedAt
      FROM dbo.ChatSessions
      WHERE sessionId = @sessionId AND userOid = @userOid AND isDeleted = 0;
    `);
  return r.recordset[0] || null;
}

async function getMessages({ sessionId, userOid }) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("sessionId", sql.UniqueIdentifier, sessionId)
    .input("userOid", sql.NVarChar(64), userOid).query(`
      SELECT m.messageId, m.role, m.content, m.createdAt
      FROM dbo.ChatMessages m
      INNER JOIN dbo.ChatSessions s
        ON s.sessionId = m.sessionId AND s.userOid = m.userOid
      WHERE m.sessionId = @sessionId AND m.userOid = @userOid AND s.isDeleted = 0
      ORDER BY m.createdAt ASC, m.messageId ASC;
    `);
  return r.recordset;
}

async function addMessage({ sessionId, userOid, role, content }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const owns = await tx
      .request()
      .input("sessionId", sql.UniqueIdentifier, sessionId)
      .input("userOid", sql.NVarChar(64), userOid).query(`
        SELECT 1 AS ok FROM dbo.ChatSessions WITH (UPDLOCK, ROWLOCK)
        WHERE sessionId = @sessionId AND userOid = @userOid AND isDeleted = 0;
      `);
    if (!owns.recordset.length) {
      await tx.rollback();
      throw new Error("Session not found or not owned by user.");
    }
    await tx
      .request()
      .input("sessionId", sql.UniqueIdentifier, sessionId)
      .input("userOid", sql.NVarChar(64), userOid)
      .input("role", sql.NVarChar(16), role)
      .input("content", sql.NVarChar(sql.MAX), content).query(`
        INSERT INTO dbo.ChatMessages (sessionId, userOid, role, content)
        VALUES (@sessionId, @userOid, @role, @content);

        UPDATE dbo.ChatSessions SET updatedAt = SYSUTCDATETIME()
        WHERE sessionId = @sessionId AND userOid = @userOid;
      `);
    await tx.commit();
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // rollback may fail if transaction already aborted; original error rethrown.
    }
    throw err;
  }
}

async function renameSession({ sessionId, userOid, title }) {
  const pool = await getPool();
  await pool
    .request()
    .input("sessionId", sql.UniqueIdentifier, sessionId)
    .input("userOid", sql.NVarChar(64), userOid)
    .input("title", sql.NVarChar(200), title).query(`
      UPDATE dbo.ChatSessions SET title = @title, updatedAt = SYSUTCDATETIME()
      WHERE sessionId = @sessionId AND userOid = @userOid AND isDeleted = 0;
    `);
}

async function deleteSession({ sessionId, userOid }) {
  const pool = await getPool();
  await pool
    .request()
    .input("sessionId", sql.UniqueIdentifier, sessionId)
    .input("userOid", sql.NVarChar(64), userOid).query(`
      UPDATE dbo.ChatSessions SET isDeleted = 1, updatedAt = SYSUTCDATETIME()
      WHERE sessionId = @sessionId AND userOid = @userOid;
    `);
}

module.exports = {
  createSession,
  listSessions,
  getSession,
  getMessages,
  addMessage,
  renameSession,
  deleteSession,
};
