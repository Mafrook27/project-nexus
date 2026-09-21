import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeFire, fireMilestones } from './calc';
import { DEFAULT_FIRE_SETTINGS } from '@/features/settings/schema';

const base = {
  ...DEFAULT_FIRE_SETTINGS,
  current_age: 30,
  retire_age: 50,
  monthly_expenses: 50_000,
  expense_ratio_in_retirement: 100,
  inflation: 6,
  pre_retirement_return: 12,
  withdrawal_rate: 4,
  monthly_investment: 50_000,
  currentCorpus: 1_000_000,
};

describe('computeFire', () => {
  it('derives the FIRE number from expenses and the withdrawal rate', () => {
    const r = computeFire(base);
    // ₹50k a month is ₹6L a year; at 4% that needs ₹1.5Cr.
    assert.equal(r.fiNumberToday, 15_000_000);
    assert.equal(r.annualExpensesToday, 600_000);
  });

  it('inflates the target to the retirement date', () => {
    const r = computeFire(base);
    assert.ok(r.fiNumberAtRetirement > r.fiNumberToday);
    assert.ok(Math.abs(r.fiNumberAtRetirement - 15_000_000 * 1.06 ** 20) < 1);
  });

  it('reports progress as a share of the target', () => {
    const r = computeFire(base);
    assert.ok(Math.abs(r.progressPct - (1_000_000 / 15_000_000) * 100) < 1e-6);
    assert.equal(r.shortfall, 14_000_000);
    assert.equal(r.achieved, false);
  });

  it('flags a corpus that already covers the target', () => {
    const r = computeFire({ ...base, currentCorpus: 20_000_000 });
    assert.equal(r.achieved, true);
    assert.equal(r.progressPct, 100);
    assert.equal(r.shortfall, 0);
    assert.equal(r.monthsToFi, 0);
  });

  it('puts Coast FIRE below the full number', () => {
    const r = computeFire(base);
    assert.ok(r.coastFiNumber < r.fiNumberAtRetirement);
    assert.ok(r.coastFiNumber > 0);
  });

  it('reaches independence sooner when you invest more', () => {
    const slow = computeFire(base);
    const fast = computeFire({ ...base, monthly_investment: 150_000 });
    assert.ok(fast.monthsToFi! < slow.monthsToFi!);
  });

  it('needs a bigger corpus at a lower withdrawal rate', () => {
    const four = computeFire(base);
    const three = computeFire({ ...base, withdrawal_rate: 3 });
    assert.ok(three.fiNumberToday > four.fiNumberToday);
  });

  it('projects from the current age with a flat target line', () => {
    const r = computeFire(base);
    assert.equal(r.projection[0].age, 30);
    assert.equal(r.projection[0].corpus, 1_000_000);
    const targets = new Set(r.projection.map((p) => p.target));
    assert.equal(targets.size, 1);
  });

  it('never returns a negative shortfall', () => {
    const r = computeFire({ ...base, currentCorpus: 99_000_000 });
    assert.ok(r.shortfall >= 0);
  });
});

describe('fireMilestones', () => {
  it('ladders from emergency-ready up to Fat FIRE', () => {
    const milestones = fireMilestones(computeFire(base));
    assert.deepEqual(
      milestones.map((m) => m.label),
      ['Emergency ready', 'Coast FIRE', 'Lean FIRE', 'FIRE', 'Fat FIRE'],
    );
    for (let i = 1; i < milestones.length; i++) {
      assert.ok(milestones[i].pct <= milestones[i - 1].pct + 1e-9);
    }
  });

  it('marks the ones already cleared', () => {
    const milestones = fireMilestones(computeFire({ ...base, currentCorpus: 500_000 }));
    assert.equal(milestones[0].reached, true); // ₹3L emergency target
    assert.equal(milestones.at(-1)!.reached, false);
  });
});
