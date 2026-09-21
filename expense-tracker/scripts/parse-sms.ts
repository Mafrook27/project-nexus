/**
 * Check one bank message from the terminal.
 *
 *   npm run parse -- "Rs.500 debited from A/c XX1234 to Swiggy Ref 123456789012"
 *   npm run parse -- --sender AD-IPPBNK "Dear Customer, your IPPB A/c ..."
 *
 * Reads stdin when no message is given, so a file of messages works too:
 *   cat messages.txt | npm run parse
 */
import { parseBankMessage } from '../src/features/transactions/parsers';

const args = process.argv.slice(2);
let sender: string | undefined;
const senderAt = args.findIndex((a) => a === '--sender' || a === '-s');
if (senderAt >= 0) {
  sender = args[senderAt + 1];
  args.splice(senderAt, 2);
}

const report = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return;
  const parsed = parseBankMessage(trimmed, sender);
  console.log(`\n${trimmed}`);
  if (!parsed) {
    console.log('  → rejected (not a transaction: a code, a balance, a promo, or not yet)');
    return;
  }
  console.log(`  → ${parsed.direction === 'credit' ? 'money in' : 'money out'} ${parsed.amount}`);
  console.log(`     bank      ${parsed.bank ?? 'unknown'}`);
  console.log(`     paid to   ${parsed.merchant ?? '(not named)'}`);
  console.log(`     method    ${parsed.paymentMethod}`);
  console.log(`     account   ${parsed.accountLast4 ?? '—'}`);
  console.log(`     reference ${parsed.reference ?? '—'}`);
  console.log(`     when      ${parsed.transactionAt ?? '(no date in message)'}`);
  console.log(`     certainty ${Math.round(parsed.confidence * 100)}%`);
};

if (args.length) {
  args.forEach(report);
} else {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (buffer += chunk));
  process.stdin.on('end', () => buffer.split(/\r?\n/).forEach(report));
}
