import { Router } from 'express';
import { z } from 'zod';
import { rows, exec } from '../db.js';
import { HttpError, wrap } from '../errors.js';

// Reusable CRUD router driven by a small config object. All SQL is plain SQL.
export function crud({ table, id, from, select = '*', searchCols, orderBy, schema, cols }) {
  const r = Router();

  r.get('/', wrap(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const q = String(req.query.q || '').trim();
    const where = q ? `WHERE ${searchCols.map(c => `${c} LIKE ?`).join(' OR ')}` : '';
    const like = q ? searchCols.map(() => `%${q}%`) : [];
    const [data, count] = await Promise.all([
      rows(`SELECT ${select} FROM ${from} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
           [...like, limit, (page - 1) * limit]),
      rows(`SELECT COUNT(*) AS n FROM ${from} ${where}`, like),
    ]);
    res.json({ data, total: count[0].n, page, limit });
  }));

  r.post('/', wrap(async (req, res) => {
    const body = schema.parse(req.body);
    const r2 = await exec(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
                          cols.map(c => body[c] ?? null));
    res.status(201).json({ [id]: r2.insertId, ...body });
  }));

  r.put('/:id', wrap(async (req, res) => {
    const body = schema.parse(req.body);
    const r2 = await exec(`UPDATE ${table} SET ${cols.map(c => `${c}=?`).join(',')} WHERE ${id}=?`,
                          [...cols.map(c => body[c] ?? null), req.params.id]);
    if (!r2.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Record not found');
    res.json({ [id]: Number(req.params.id), ...body });
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const r2 = await exec(`DELETE FROM ${table} WHERE ${id}=?`, [req.params.id]);
    if (!r2.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Record not found');
    res.status(204).end();
  }));

  return r;
}

// helpers: blank string -> null for optional text fields
export const optText = max => z.preprocess(v => (v === '' ? null : v), z.string().trim().max(max).nullish());
export const reqText = max => z.string().trim().min(1, 'Required').max(max);
