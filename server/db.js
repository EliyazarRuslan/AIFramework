// MSSQL connection pool for AIFramework.
const sql = require("mssql");

const config = {
  server: process.env.MSSQL_SERVER || "GBITR01V.goldbell.com.sg",
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE || "AIFramework",
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    if (!config.user || !config.password) {
      return Promise.reject(new Error("MSSQL_USER / MSSQL_PASSWORD not configured."));
    }
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log(`[db] connected: ${config.server}/${config.database}`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
