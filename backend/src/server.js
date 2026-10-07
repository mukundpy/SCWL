import { app } from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`API on http://localhost:${port}`));
server.requestTimeout = 15_000;   // never let a slow client hold a socket forever
server.keepAliveTimeout = 65_000;

const stop = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
