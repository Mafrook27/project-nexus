/**
 * Turns the driver's errors into something you can act on.
 *
 * "Server selection timed out after 15000 ms" is accurate and tells you
 * nothing if you have not seen it before. These are the failures that actually
 * happen when someone sets this up, and what each one means in practice.
 */
export function explainDbError(message: string): string[] {
  if (/Server selection timed out|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Topology is closed/i.test(message)) {
    return [
      'The database could not be reached. Usually one of:',
      '  • Atlas is not letting this machine in. Atlas → Network Access →',
      '    Add IP Address. Use "Allow access from anywhere" (0.0.0.0/0) if you',
      '    are deploying to Vercel or Render, which have no fixed IP.',
      '  • The cluster name in MONGODB_URI is wrong, or the cluster is paused.',
      '  • A local mongod is not running.',
    ];
  }
  if (/bad auth|Authentication failed|not authorized/i.test(message)) {
    return [
      'The database refused the username or password.',
      '  • Check the user under Atlas → Database Access.',
      '  • If the password contains @ : / or #, percent-encode it in the URI.',
    ];
  }
  if (/MONGODB_URI is not set/i.test(message)) {
    return ['Run `npm run setup`, or put MONGODB_URI in .env.local.'];
  }
  return [];
}

/** Prints the message, then whatever advice applies to it. */
export function reportDbError(prefix: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`\n\x1b[31m${prefix}\x1b[0m ${message}\n`);
  const advice = explainDbError(message);
  for (const line of advice) console.log(line);
  if (advice.length) console.log('');
  return message;
}
