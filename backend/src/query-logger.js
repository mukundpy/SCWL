import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'query-history.json');
const MAX_HISTORY = 1000;

let history = [];
let isLoaded = false;
let saveTimeout = null;
let counter = 1;

function loadHistory() {
  if (isLoaded) return;
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        history = data;
      }
    }
  } catch (err) {
    console.error('Failed to load query history:', err.message);
  }
  isLoaded = true;
}

function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, MAX_HISTORY), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save query history:', err.message);
    }
  }, 1000);
}

export function inlineParams(sql, params = []) {
  if (!params || !params.length) return sql.trim();
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx >= params.length) return '?';
    const val = params[idx++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'string') {
      return `'${val.replace(/'/g, "''")}'`;
    }
    if (typeof val === 'object') {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    return String(val);
  }).trim();
}

export function detectQueryType(sql) {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('SELECT')) return 'SELECT';
  if (s.startsWith('INSERT')) return 'INSERT';
  if (s.startsWith('UPDATE')) return 'UPDATE';
  if (s.startsWith('DELETE')) return 'DELETE';
  if (s.startsWith('CALL')) return 'CALL';
  if (s.startsWith('SHOW')) return 'SHOW';
  if (s.startsWith('CREATE') || s.startsWith('ALTER') || s.startsWith('DROP')) return 'DDL';
  return 'OTHER';
}

export function recordQuery({ sql, params = [], durationMs = 0, error = null, rowsCount, affectedRows, insertId }) {
  loadHistory();
  const rawSql = String(sql || '').trim();
  if (!rawSql || rawSql === 'SELECT 1') return; // Skip health checks

  const now = new Date();
  const type = detectQueryType(rawSql);
  const formattedSql = inlineParams(rawSql, params);

  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: true,
  });

  const entry = {
    id: `q_${Date.now()}_${counter++}`,
    sql: formattedSql,
    rawSql,
    params: Array.isArray(params) ? params : [],
    type,
    status: error ? 'error' : 'success',
    error: error || null,
    durationMs: durationMs || 0,
    rowsCount: typeof rowsCount === 'number' ? rowsCount : undefined,
    affectedRows: typeof affectedRows === 'number' ? affectedRows : undefined,
    insertId: typeof insertId === 'number' ? insertId : undefined,
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
  };

  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  scheduleSave();
  return entry;
}

export function getQueryHistory({ limit = 100, type = null, search = null } = {}) {
  loadHistory();
  let list = history;

  if (type && type !== 'ALL') {
    list = list.filter(q => q.type.toUpperCase() === type.toUpperCase());
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(item =>
      item.sql.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.date.toLowerCase().includes(q) ||
      item.time.toLowerCase().includes(q) ||
      (item.error && item.error.toLowerCase().includes(q))
    );
  }

  const total = list.length;
  const paginated = list.slice(0, limit);

  const stats = {
    total: history.length,
    SELECT: history.filter(q => q.type === 'SELECT').length,
    INSERT: history.filter(q => q.type === 'INSERT').length,
    UPDATE: history.filter(q => q.type === 'UPDATE').length,
    DELETE: history.filter(q => q.type === 'DELETE').length,
    CALL: history.filter(q => q.type === 'CALL').length,
    OTHER: history.filter(q => !['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CALL'].includes(q.type)).length,
  };

  return {
    queries: paginated,
    total,
    stats,
  };
}

export function clearQueryHistory() {
  loadHistory();
  const count = history.length;
  history = [];
  scheduleSave();
  return count;
}
