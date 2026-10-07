import 'dotenv/config';
import mysql from 'mysql2/promise';
import { embeddedDb } from './embedded-db.js';

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
  if (useMysql && rawPool) {
    const [r] = await rawPool.query(sql, params);
    return r;
  }
  return embeddedDb.rows(sql, params);
}

export async function call(sql, params = []) {
  if (useMysql && rawPool) {
    const [r] = await rawPool.query(sql, params);
    return Array.isArray(r) && Array.isArray(r[0]) ? r[0] : [];
  }
  return embeddedDb.call(sql, params);
}

export async function exec(sql, params = []) {
  if (useMysql && rawPool) {
    const [r] = await rawPool.query(sql, params);
    return r;
  }
  return embeddedDb.exec(sql, params);
}
