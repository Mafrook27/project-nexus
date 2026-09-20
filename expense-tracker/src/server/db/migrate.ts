/**
 * MongoDB creates collections on first write, so there is no schema to apply.
 * What does need creating is the indexes - including the two UNIQUE ones the
 * app relies on for correctness, not just for speed.
 *
 *   npm run db:migrate
 *   npm run db:reset    (drops every collection first)
 */
import './env';
import { COLLECTIONS, closeClient, col, getDb, type AnyDoc } from './mongo';
import { ensureIndexes } from './indexes';
import { reportDbError } from './explain';

async function main() {
  if (process.argv.includes('--reset')) {
    console.log('· dropping every collection');
    for (const name of Object.values(COLLECTIONS)) {
      await col<AnyDoc>(name).drop().catch(() => {});
    }
  }

  const report = await ensureIndexes();
  const created = report.reduce((sum, r) => sum + r.created, 0);
  console.log(`✓ indexes ready on ${getDb().databaseName} (${created} created)`);
  for (const row of report.filter((r) => r.created > 0)) {
    console.log(`  ${row.collection}: +${row.created}`);
  }
  await closeClient();
}

main().catch(async (err) => {
  reportDbError('Migration failed:', err);
  await closeClient().catch(() => {});
  process.exit(1);
});
