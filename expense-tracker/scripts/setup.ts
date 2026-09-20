/**
 * One command to get from a fresh clone to a running app.
 *
 *   npm run setup
 *
 * Generates the auth secret, collects a MongoDB connection string, proves the
 * connection works before writing anything, creates the indexes and optionally
 * loads demo data. Re-running it is safe.
 *
 * Non-interactive too, for CI or a rebuild:
 *   MONGODB_URI=mongodb+srv://... npm run setup -- --yes
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

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
  let url = process.env.MONGODB_URI ?? existing.MONGODB_URI ?? '';
  if (url && !autoYes) {
    console.log(`Found a database URL already: ${c.dim(mask(url))}`);
    if (!(await confirm('Keep it?'))) url = '';
  }

  while (!url) {
    console.log(`\nWhere should the data live?\n`);
    console.log(`  ${c.bold('1')}  MongoDB Atlas  ${c.dim('free M0, never expires. https://cloud.mongodb.com')}`);
    console.log(`  ${c.bold('2')}  Local mongod   ${c.dim('already running on this machine')}`);
    console.log(`  ${c.bold('3')}  Docker         ${c.dim('spin one up, command printed for you')}\n`);
    const choice = await ask('Pick 1-3: ', '1');

    if (choice === '2') {
      url = await ask(
        `Connection URI ${c.dim('[mongodb://localhost:27017/paisa]')}: `,
        'mongodb://localhost:27017/paisa',
      );
    } else if (choice === '3') {
      console.log(`\nRun this in another terminal, then come back:\n`);
      // A replica set, not a bare mongod: multi-document transactions need one.
      console.log(
        c.blue(
          '  docker run -d --name paisa-db -p 27017:27017 mongo:7 --replSet rs0\n' +
            '  docker exec paisa-db mongosh --quiet --eval "rs.initiate()"\n',
        ),
      );
      await ask('Press enter once it is running. ');
      url = 'mongodb://localhost:27017/paisa?directConnection=true';
    } else {
      console.log(`\n  1. Sign up at ${c.blue('https://cloud.mongodb.com')} and create a free M0 cluster`);
      console.log(`  2. Database Access → add a user, and ${c.bold('let Atlas generate the password')}`);
      console.log(`  3. Network Access → allow your IP, or 0.0.0.0/0 if your host's IP moves`);
      console.log(`  4. Connect → Drivers → copy the connection string\n`);
      console.log(c.dim('     It looks like mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/\n'));
      url = await ask('Paste it here: ');
      // Atlas leaves the database name out; without one everything lands in "test".
      if (url && !/\/[A-Za-z0-9_-]+(\?|$)/.test(url.replace(/^mongodb(\+srv)?:\/\//, ''))) {
        url = url.includes('?')
          ? url.replace('?', '/paisa?')
          : `${url.replace(/\/$/, '')}/paisa`;
        console.log(c.dim(`  Added the database name: …/paisa`));
      }
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

  await writeEnv({ ...existing, MONGODB_URI: url, AUTH_SECRET: secret });
  console.log(`Wrote ${c.bold('.env.local')}`);

  // ---- indexes ------------------------------------------------------------
  // MongoDB creates collections on first write, so there is nothing to create
  // except the indexes - including the unique ones the app relies on for
  // correctness rather than for speed.
  process.stdout.write('Creating indexes… ');
  process.env.MONGODB_URI = url;
  const { ensureIndexes } = await import('../src/server/db/indexes');
  const { closeClient } = await import('../src/server/db/mongo');
  const report = await ensureIndexes();
  await closeClient();
  console.log(c.green(`done (${report.reduce((n, r) => n + r.created, 0)} created)`));

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
    `MONGODB_URI="${values.MONGODB_URI}"`,
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

async function testConnection(url: string): Promise<string | null> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 15_000 });
  try {
    await client.connect();
    const info = await client.db('admin').command({ hello: 1 });
    if (!info.setName) {
      console.log(
        c.dim('\n  Note: this is a single node, not a replica set. Everything works, but a'),
      );
      console.log(c.dim('  batch of spends is written one at a time instead of all-or-nothing.'));
      process.stdout.write('  ');
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message.split('\n')[0] : String(err);
  } finally {
    await client.close().catch(() => {});
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
