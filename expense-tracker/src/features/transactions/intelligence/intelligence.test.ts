import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountsAgree, merchantsAgree, normaliseMerchant, pickDuplicate } from './dedupe';
import { matchRule, statusFor, type MerchantRule } from './rules';

const at = new Date('2026-09-20T13:10:00Z');

describe('merchant matching', () => {
  it('ignores case, spacing and punctuation', () => {
    assert.equal(normaliseMerchant('Swiggy Ltd.'), 'swiggyltd');
    assert.equal(merchantsAgree('SWIGGY', 'swiggy'), true);
    assert.equal(merchantsAgree('Swiggy', 'Swiggy India'), true);
  });

  it('treats a missing name as agreeing, since one channel often omits it', () => {
    assert.equal(merchantsAgree(null, 'Swiggy'), true);
    assert.equal(merchantsAgree('Swiggy', undefined), true);
  });

  it('keeps genuinely different shops apart', () => {
    assert.equal(merchantsAgree('Swiggy', 'Zomato'), false);
    assert.equal(merchantsAgree('Uber', 'Ubereats'), true); // prefix, same brand
    assert.equal(merchantsAgree('Ola', 'Olx'), false); // too short to prefix-match
  });
});

describe('account matching', () => {
  it('agrees when either side is unknown', () => {
    assert.equal(accountsAgree(null, '1234'), true);
    assert.equal(accountsAgree('1234', null), true);
  });
  it('separates two accounts', () => {
    assert.equal(accountsAgree('1234', '5678'), false);
    assert.equal(accountsAgree('1234', '1234'), true);
  });
});

describe('pickDuplicate', () => {
  const incoming = { amount: 500, merchant: 'Swiggy', accountLast4: '1234', transactionAt: at };

  it('matches the same payment seen on another channel', () => {
    const found = pickDuplicate(incoming, [
      { id: 'a', merchant: null, account_last4: '1234' },
    ]);
    assert.equal(found?.id, 'a');
  });

  it('does not match a different shop for the same amount', () => {
    const found = pickDuplicate(incoming, [
      { id: 'a', merchant: 'Zomato', account_last4: '1234' },
    ]);
    assert.equal(found, null);
  });

  it('does not match the same shop on a different account', () => {
    const found = pickDuplicate(incoming, [
      { id: 'a', merchant: 'Swiggy', account_last4: '9999' },
    ]);
    assert.equal(found, null);
  });

  it('returns nothing when the window is empty', () => {
    assert.equal(pickDuplicate(incoming, []), null);
  });
});

describe('matchRule', () => {
  const rule = (over: Partial<MerchantRule>): MerchantRule => ({
    id: 'r',
    pattern: 'swiggy',
    match_type: 'contains',
    category_id: 'cat',
    bucket: null,
    need_level: null,
    auto_confirm: true,
    ...over,
  });

  it('matches on a substring, ignoring case', () => {
    const found = matchRule('SWIGGY INSTAMART', [rule({})]);
    assert.equal(found?.id, 'r');
  });

  it('prefers an exact rule over a contains rule', () => {
    const found = matchRule('amazon', [
      rule({ id: 'contains', pattern: 'amazon', match_type: 'contains' }),
      rule({ id: 'exact', pattern: 'amazon', match_type: 'exact' }),
    ]);
    assert.equal(found?.id, 'exact');
  });

  it('prefers the more specific of two contains rules', () => {
    const found = matchRule('amazon prime video', [
      rule({ id: 'broad', pattern: 'amazon' }),
      rule({ id: 'narrow', pattern: 'amazon prime video' }),
    ]);
    assert.equal(found?.id, 'narrow');
  });

  it('returns nothing without a merchant name', () => {
    assert.equal(matchRule(null, [rule({})]), null);
    assert.equal(matchRule('', [rule({})]), null);
  });

  it('returns nothing when no rule applies', () => {
    assert.equal(matchRule('Zomato', [rule({})]), null);
  });
});

describe('statusFor', () => {
  const r = (over: Partial<MerchantRule> = {}): MerchantRule => ({
    id: 'r',
    pattern: 'swiggy',
    match_type: 'contains',
    category_id: 'cat',
    bucket: null,
    need_level: null,
    auto_confirm: true,
    ...over,
  });

  it('sorts silently when a trusted rule matches', () => {
    assert.equal(statusFor(r(), 0.9), 'categorized');
  });

  it('still asks when the rule only pre-fills', () => {
    assert.equal(statusFor(r({ auto_confirm: false }), 0.9), 'detected');
  });

  it('still asks when the parse was a guess', () => {
    assert.equal(statusFor(r(), 0.4), 'detected');
  });

  it('asks when nothing is known', () => {
    assert.equal(statusFor(null, 0.9), 'detected');
  });

  it('asks when the rule has no category to apply', () => {
    assert.equal(statusFor(r({ category_id: null }), 0.9), 'detected');
  });
});
