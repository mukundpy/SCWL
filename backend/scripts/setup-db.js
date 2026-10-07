// Runs the four SQL files in order using the mysql CLI (needed for DELIMITER support).
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const files = ['01_schema.sql', '02_views.sql', '03_routines.sql', '04_seed.sql'];
const args = ['-h', process.env.DB_HOST || 'localhost', '-P', process.env.DB_PORT || '3306',
              '-u', process.env.DB_USER || 'root'];
if (process.env.DB_PASSWORD) args.push(`-p${process.env.DB_PASSWORD}`);

for (const f of files) {
  process.stdout.write(`Running ${f} ... `);
  const r = spawnSync('mysql', args, { input: readFileSync(path.join(dir, f)), encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error('FAILED\n', r.error?.message || r.stderr);
    process.exit(1);
  }
  console.log('ok');
}
console.log('Database ready.');
