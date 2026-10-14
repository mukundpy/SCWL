import 'dotenv/config';
import mysql from 'mysql2/promise';
import { embeddedDb } from './embedded-db.js';
import { recordQuery } from './query-logger.js';

const useMysql = process.env.DB_MODE === 'mysql';

let rawPool = null;
if (useMysql) {
  rawPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supply_chain',
    connectionLimit: Number(process.env.DB_POOL || 10),
    queueLimit: 200,
    waitForConnections: true,
    decimalNumbers: true,
    dateStrings: true,
    enableKeepAlive: true,
  });
}

export const pool = {
  query: async (sql, params = []) => {
    if (useMysql && rawPool) return rawPool.query(sql, params);
    const r = await embeddedDb.rows(sql, params);
    return [r];
  },
  end: async () => {
    if (useMysql && rawPool) await rawPool.end();
  },
};

export async function rows(sql, params = []) {
  const start = performance.now();
  let result;
  let error = null;
  try {
    if (useMysql && rawPool) {
      const [r] = await rawPool.query(sql, params);
      result = r;
      return r;
    }
    result = await embeddedDb.rows(sql, params);
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    recordQuery({
      sql,
      params,
      durationMs: Math.round((performance.now() - start) * 10) / 10,
      error: error ? error.message : null,
      rowsCount: Array.isArray(result) ? result.length : undefined,
    });
  }
}

export async function call(sql, params = []) {
  const start = performance.now();
  let result;
  let error = null;
  try {
    if (useMysql && rawPool) {
      const [r] = await rawPool.query(sql, params);
      result = Array.isArray(r) && Array.isArray(r[0]) ? r[0] : [];
      return result;
    }
    result = await embeddedDb.call(sql, params);
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    recordQuery({
      sql,
      params,
      durationMs: Math.round((performance.now() - start) * 10) / 10,
      error: error ? error.message : null,
      rowsCount: Array.isArray(result) ? result.length : undefined,
    });
  }
}

export async function exec(sql, params = []) {
  const start = performance.now();
  let result;
  let error = null;
  try {
    if (useMysql && rawPool) {
      const [r] = await rawPool.query(sql, params);
      result = r;
      return r;
    }
    result = await embeddedDb.exec(sql, params);
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    recordQuery({
      sql,
      params,
      durationMs: Math.round((performance.now() - start) * 10) / 10,
      error: error ? error.message : null,
      affectedRows: result?.affectedRows,
      insertId: result?.insertId,
    });
  }
}
