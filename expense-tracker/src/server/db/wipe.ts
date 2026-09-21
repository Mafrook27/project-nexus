import { COLLECTIONS, col, users, type AnyDoc } from './mongo';

/**
 * Removes everything belonging to one user.
 *
 * Postgres did this with ON DELETE CASCADE. MongoDB has no foreign keys, so it
 * has to be written out - which is exactly the cost of dropping referential
 * integrity, made visible.
 */
export async function deleteEverythingFor(userId: string): Promise<number> {
  let removed = 0;
  for (const name of Object.values(COLLECTIONS)) {
    if (name === 'users') continue;
    const result = await col<AnyDoc>(name).deleteMany({ user_id: userId });
    removed += result.deletedCount ?? 0;
  }
  await users().deleteOne({ _id: userId });
  return removed;
}
