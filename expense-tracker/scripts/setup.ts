/**
 * One command to get from a fresh clone to a running app.
 *
 *   npm run setup
 *
 * Generates the auth secret, collects a database URL, proves the connection
 * works before writing anything, creates the tables and optionally loads demo
 * data. Re-running it is safe.
 *
 * Non-interactive too, for CI or a rebuild:
 *   DATABASE_URL=postgres://... npm run setup -- --yes
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');
const autoYes = process.argv.includes('--yes') || process.argv.includes('-y');

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question: string, fallback = '') => {
  if (autoYes) return fallback;
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
};
const confirm = async (question: string, fallback = true) => {
  if (autoYes) return fallback;
  const answer = (await rl.question(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `))
    .trim()
    .toLowerCase();
  if (!answer) return fallback;
  return answer.startsWith('y');
};

async function main() {
  console.log(`\n${c.bold('Paisa setup')}\n`);

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.log(c.red(`Node ${process.versions.node} is too old. Install Node 20 or newer.`));
    process.exit(1);
  }

  const existing = await readEnv();

  // ---- database -----------------------------------------------------------
  let url = process.env.DATABASE_URL ?? existing.DATABASE_URL ?? '';
  if (url && !autoYes) {
    console.log(`Found a database URL already: ${c.dim(mask(url))}`);
    if (!(await confirm('Keep it?'))) url = '';
  }

  while (!url) {
    console.log(`\nWhere should the data live?\n`);
    console.log(`  ${c.bold('1')}  Neon        ${c.dim('free forever, no card. https://neon.tech')}`);
    console.log(`  ${c.bold('2')}  Supabase    ${c.dim('free 500MB, pauses when idle')}`);
    console.log(`  ${c.bold('3')}  Local       ${c.dim('Postgres already on this machine')}`);
    console.log(`  ${c.bold('4')}  Docker      ${c.dim('spin one up, command printed for you')}\n`);
    const choice = await ask('Pick 1-4: ', '1');

    if (choice === '3') {
      url = await ask(
        `Connection URL ${c.dim('[postgresql://localhost:5432/paisa]')}: `,
        'postgresql://localhost:5432/paisa',
      );
    } else if (choice === '4') {
      console.log(`\nRun this in another terminal, then come back:\n`);
      console.log(
        c.blue(
          '  docker run -d --name paisa-db -e POSTGRES_PASSWORD=paisa -p 5432:5432 postgres:16\n',
        ),
      );
      await ask('Press enter once it is running. ');
      url = 'postgresql://postgres:paisa@localhost:5432/postgres';
    } else {
      const site = choice === '2' ? 'https://supabase.com' : 'https://neon.tech';
      console.log(`\n  1. Sign up at ${c.blue(site)} and create a project`);
      console.log(`  2. Copy the ${c.bold('pooled')} connection string`);
      console.log(
        c.dim('     (the one with -pooler in the host. It survives serverless reconnects.)\n'),
      );
      url = await ask('Paste it here: ');
    }

    if (!url) continue;
    process.stdout.write('Testing the connection… ');
    const error = await testConnection(url);
    if (error) {
      console.log(c.red('failed'));
      console.log(c.dim(`  ${error}\n`));
      url = '';
    } else {
      console.log(c.green('works'));
    }
  }

  // ---- secret -------------------------------------------------------------
  // Generated rather than asked for. Nobody should have to look up an openssl
  // incantation to run an app, and a pasted secret is a weak secret.
  const secret = existing.AUTH_SECRET?.length >= 32
    ? existing.AUTH_SECRET
    : randomBytes(48).toString('base64');
  if (secret !== existing.AUTH_SECRET) console.log('Generated a new sign-in secret.');

  await writeEnv({ ...existing, DATABASE_URL: url, AUTH_SECRET: secret });
  console.log(`Wrote ${c.bold('.env.local')}`);

  // ---- tables -------------------------------------------------------------
  process.stdout.write('Creating tables… ');
  await applySchema(url);
  console.log(c.green('done'));

  // ---- demo data ----------------------------------------------------------
  if (await confirm('\nLoad a year of demo data to look around?')) {
    console.log('');
    execFileSync('npm', ['run', 'db:seed'], { cwd: root, stdio: 'inherit' });
  }

  console.log(`\n${c.green('Ready.')} Start it with:\n`);
  console.log(c.blue('  npm run dev\n'));
  console.log(`Then open ${c.blue('http://localhost:3000')}`);
  console.log(c.dim('Demo sign-in, if you loaded it: demo@paisa.app / demo1234\n'));
  rl.close();
}

async function readEnv(): Promise<Record<string, string>> {
  if (!existsSync(envPath)) return {};
  const text = await readFile(envPath, 'utf8');
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

async function writeEnv(values: Record<string, string>) {
  const body = [
    '# Written by `npm run setup`. Never commit this file.',
    `DATABASE_URL="${values.DATABASE_URL}"`,
    `AUTH_SECRET="${values.AUTH_SECRET}"`,
    '',
    '# Optional: only these emails may register. Empty means anyone can.',
    `ALLOWED_EMAILS="${values.ALLOWED_EMAILS ?? ''}"`,
    '',
    '# Optional: the demo account `npm run db:seed` creates.',
    `SEED_EMAIL="${values.SEED_EMAIL ?? 'demo@paisa.app'}"`,
    `SEED_PASSWORD="${values.SEED_PASSWORD ?? 'demo1234'}"`,
    '',
  ].join('\n');
  await writeFile(envPath, body, { mode: 0o600 });
}

function poolFor(url: string) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    max: 1,
  });
}

async function testConnection(url: string): Promise<string | null> {
  const pool = poolFor(url);
  try {
    await pool.query('SELECT 1');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function applySchema(url: string) {
  const sql = await readFile(join(root, 'src/server/db/schema.sql'), 'utf8');
  const pool = poolFor(url);
  try {
    await pool.query(sql);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(async (err) => {
  console.log(c.red(`\nSetup stopped: ${err instanceof Error ? err.message : err}\n`));
  rl.close();
  process.exit(1);
});

/** Hides the password when echoing a URL back. */
function mask(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••@');
}
