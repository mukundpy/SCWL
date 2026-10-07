import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './errors.js';
import { suppliers, products, warehouses, carriers, lookups } from './routes/master.js';
import inventory from './routes/inventory.js';
import shipments from './routes/shipments.js';
import { dashboard, track } from './routes/dashboard.js';
import { pool } from './db.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'db_down' }); }
});

app.use('/api/dashboard', dashboard);
app.use('/api/lookups', lookups);
app.use('/api/suppliers', suppliers);
app.use('/api/products', products);
app.use('/api/warehouses', warehouses);
app.use('/api/carriers', carriers);
app.use('/api/inventory', inventory);
app.use('/api/shipments', shipments);
app.use('/api/track', track);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } }));

// In production, serve the built frontend from the same process
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);
