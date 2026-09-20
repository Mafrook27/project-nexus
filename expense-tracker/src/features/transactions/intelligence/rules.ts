/**
 * "Swiggy is always Food." Rules are learned from the answers you give the
 * review queue, so the app stops asking about merchants you have explained.
 */
import { normaliseMerchant } from './dedupe';

export type MerchantRule = {
  id: string;
  pattern: string;
  match_type: 'contains' | 'exact';
  category_id: string | null;
  bucket: string | null;
  need_level: string | null;
  auto_confirm: boolean;
};

/**
 * The most specific rule wins: an exact match beats a contains match, and a
 * longer pattern beats a shorter one. Without that ordering a rule for "amazon"
 * would swallow a more deliberate rule for "amazon prime video".
 */
export function matchRule(
  merchant: string | null | undefined,
  rules: MerchantRule[],
): MerchantRule | null {
  const name = normaliseMerchant(merchant);
  if (!name) return null;

  const matches = rules.filter((rule) => {
    const pattern = normaliseMerchant(rule.pattern);
    if (!pattern) return false;
    return rule.match_type === 'exact' ? name === pattern : name.includes(pattern);
  });
  if (!matches.length) return null;

  return matches.sort((a, b) => {
    if (a.match_type !== b.match_type) return a.match_type === 'exact' ? -1 : 1;
    return b.pattern.length - a.pattern.length;
  })[0];
}

/**
 * The status a freshly detected transaction should land in.
 *
 * A rule you marked "always do this" sorts it silently. Anything else waits in
 * the review queue - including a low-confidence parse, because a merchant the
 * parser guessed at is exactly the case where a human should look.
 */
export function statusFor(rule: MerchantRule | null, confidence: number): 'categorized' | 'detected' {
  if (rule?.auto_confirm && rule.category_id && confidence >= 0.5) return 'categorized';
  return 'detected';
}
