import { Router } from 'express';
import { getQueryHistory, clearQueryHistory } from '../query-logger.js';
import { rows, exec, call } from '../db.js';
import { wrap } from '../errors.js';

const r = Router();

r.get('/', (req, res) => {
  const { limit, type, search } = req.query;
  const result = getQueryHistory({
    limit: limit ? parseInt(limit, 10) : 100,
    type: type || null,
    search: search || null,
  });
  res.json(result);
});

r.delete('/', (req, res) => {
  const count = clearQueryHistory();
  res.json({ ok: true, cleared: count });
});

r.post('/execute', wrap(async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return res.status(400).json({ error: { code: 'INVALID_SQL', message: 'SQL query cannot be empty' } });
  }
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  let result;
  if (upper.startsWith('CALL')) {
    result = await call(trimmed);
  } else if (upper.startsWith('SELECT') || upper.startsWith('SHOW') || upper.startsWith('DESCRIBE') || upper.startsWith('EXPLAIN')) {
    result = await rows(trimmed);
  } else {
    result = await exec(trimmed);
  }
  res.json({ ok: true, result });
}));

export default r;
