'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flame, Info, Save } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { Meter } from '@/components/ui/Meter';
import { Slider } from '@/components/ui/Slider';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { FireProjection, FIRE_LEGEND } from '@/components/charts/FireProjection';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { compactMoney, formatMoney } from '@/lib/money';
import { SERIES } from '@/lib/viz';
import { computeFire, fireMilestones } from '../calc';
import { DEFAULT_FIRE_SETTINGS } from '@/features/settings/schema';
import { useReference } from '@/features/settings/ReferenceData';
import type { DashboardData } from '@/features/dashboard/service';

/**
 * Everything here recalculates in the browser as you drag, and only hits the
 * server when you press Save. The corpus comes from your real holdings.
 */
export function FireView() {
  const { currency, refresh } = useReference();
  const { toast } = useToast();
  const { run, pending } = useAction();
  const { data, error, loading, reload } = useResource<DashboardData>('/api/dashboard');

  const [settings, setSettings] = useState(DEFAULT_FIRE_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setSettings({ ...DEFAULT_FIRE_SETTINGS, ...data.settings });
      setDirty(false);
    }
  }, [data?.settings]);

  const corpus = data ? data.portfolio.liquidCorpus + data.netWorth.emergencyCash : 0;
  const result = useMemo(
    () => computeFire({ ...settings, currentCorpus: corpus }),
    [settings, corpus],
  );
  const milestones = useMemo(() => fireMilestones(result), [result]);

  const set = <K extends keyof typeof settings>(key: K, value: number) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  };

  async function save() {
    const saved = await run(() => api.patch('/api/auth/me', { settings }));
    if (saved) {
      toast('Assumptions saved');
      setDirty(false);
      void refresh();
      void reload();
    }
  }

  // What one more lever would buy you.
  const scenarios = useMemo(() => {
    const base = result.monthsToFi;
    const variants = [
      { label: `Invest ${formatMoney(settings.monthly_investment * 1.25, currency)} a month`, change: { monthly_investment: settings.monthly_investment * 1.25 } },
      { label: 'Spend 10% less every month', change: { monthly_expenses: settings.monthly_expenses * 0.9 } },
      { label: 'Earn 2% more a year', change: { pre_retirement_return: settings.pre_retirement_return + 2 } },
      { label: 'Withdraw 3.5% instead', change: { withdrawal_rate: 3.5 } },
    ];
    return variants.map((v) => {
      const alt = computeFire({ ...settings, ...v.change, currentCorpus: corpus });
      const saved = base !== null && alt.monthsToFi !== null ? base - alt.monthsToFi : null;
      return { label: v.label, months: alt.monthsToFi, saved, fiNumber: alt.fiNumberToday };
    });
  }, [settings, corpus, result.monthsToFi, currency]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <LoadingCard height="h-96" />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <Flame className="size-5 text-brand" /> Financial independence
          </h1>
          <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
            The corpus that can pay for your life without a salary. Drag the assumptions and watch
            the date move.
          </p>
        </div>
        {dirty ? (
          <Button size="sm" onClick={save} loading={pending}>
            <Save className="size-4" /> Save assumptions
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Your FIRE number"
          value={formatMoney(result.fiNumberToday, currency)}
          sub={`In today's money at a ${settings.withdrawal_rate}% withdrawal rate`}
          accent={SERIES[0]}
        />
        <StatTile
          label="Corpus today"
          value={formatMoney(result.currentCorpus, currency)}
          sub="Liquid investments plus emergency cash"
        />
        <StatTile
          label="Progress"
          value={`${result.progressPct.toFixed(1)}%`}
          sub={
            result.achieved
              ? 'You are financially independent'
              : `${formatMoney(result.shortfall, currency)} still to go`
          }
          accent={SERIES[2]}
        />
        <StatTile
          label="Freedom age"
          value={result.fiAge ? String(Math.round(result.fiAge)) : '—'}
          sub={
            result.monthsToFi === null
              ? 'Add a monthly investment below'
              : `${(result.monthsToFi / 12).toFixed(1)} years away`
          }
          accent={result.onTrack ? SERIES[2] : SERIES[1]}
        />
      </div>

      {result.achieved ? (
        <div className="rounded-2xl border border-good/30 bg-good-soft px-5 py-4">
          <p className="text-[15px] font-semibold text-good-ink">
            You have hit your FIRE goal. 🎉
          </p>
          <p className="mt-1 text-[13px] text-good-ink/85">
            Your corpus of {formatMoney(result.currentCorpus, currency)} supports{' '}
            {formatMoney(result.safeMonthlyWithdrawalNow, currency)} a month at a{' '}
            {settings.withdrawal_rate}% withdrawal rate. Work is now optional, not mandatory.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Your path to independence"
          subtitle="Inflation-adjusted, so the target line stays flat in today's rupees"
          legend={FIRE_LEGEND}
          className="lg:col-span-2"
          height="h-[300px]"
          table={
            <TableWrap>
              <thead>
                <tr>
                  <Th>Age</Th>
                  <Th align="right">Corpus</Th>
                  <Th align="right">Target</Th>
                </tr>
              </thead>
              <tbody>
                {result.projection
                  .filter((_, i) => i % 2 === 0)
                  .map((p) => (
                    <tr key={p.age}>
                      <Td>{p.age}</Td>
                      <Td align="right">{formatMoney(p.corpus, currency)}</Td>
                      <Td align="right">{formatMoney(p.target, currency)}</Td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          }
        >
          <FireProjection
            data={result.projection}
            currency={currency}
            crossingAge={result.fiAge}
          />
        </ChartFrame>

        <Card>
          <CardHeader title="Milestones" subtitle="Each one is a real change in your options" />
          <ul className="space-y-4">
            {milestones.map((m) => (
              <li key={m.label}>
                <Meter
                  label={m.label}
                  value={result.currentCorpus}
                  max={m.target}
                  right={compactMoney(m.target, currency)}
                  tone={m.reached ? 'good' : 'brand'}
                  caption={m.reached ? 'Reached' : `${m.pct.toFixed(0)}% there`}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your assumptions"
            subtitle="These drive every number on this page"
          />
          <div className="space-y-5">
            <Slider
              label="Current age"
              value={settings.current_age}
              onChange={(v) => set('current_age', v)}
              min={18}
              max={70}
              display={`${settings.current_age}`}
            />
            <Slider
              label="Target retirement age"
              value={settings.retire_age}
              onChange={(v) => set('retire_age', v)}
              min={settings.current_age + 1}
              max={75}
              display={`${settings.retire_age}`}
            />
            <Slider
              label="Monthly expenses today"
              value={settings.monthly_expenses}
              onChange={(v) => set('monthly_expenses', v)}
              min={5000}
              max={500000}
              step={1000}
              display={formatMoney(settings.monthly_expenses, currency)}
              hint={
                data
                  ? `Your actual average is ${formatMoney(data.totals.avgMonthlyExpense, currency)} a month.`
                  : undefined
              }
            />
            <Slider
              label="Monthly investment"
              value={settings.monthly_investment}
              onChange={(v) => set('monthly_investment', v)}
              min={0}
              max={500000}
              step={1000}
              display={formatMoney(settings.monthly_investment, currency)}
            />
            <Slider
              label="Expenses after retiring"
              value={settings.expense_ratio_in_retirement}
              onChange={(v) => set('expense_ratio_in_retirement', v)}
              min={40}
              max={130}
              display={`${settings.expense_ratio_in_retirement}% of today`}
              hint="Commutes and EMIs fall away; healthcare and travel often rise."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Market assumptions" subtitle="Conservative beats optimistic here" />
          <div className="space-y-5">
            <Slider
              label="Return before retirement"
              value={settings.pre_retirement_return}
              onChange={(v) => set('pre_retirement_return', v)}
              min={4}
              max={20}
              step={0.5}
              display={`${settings.pre_retirement_return}%`}
            />
            <Slider
              label="Return after retirement"
              value={settings.post_retirement_return}
              onChange={(v) => set('post_retirement_return', v)}
              min={3}
              max={15}
              step={0.5}
              display={`${settings.post_retirement_return}%`}
            />
            <Slider
              label="Inflation"
              value={settings.inflation}
              onChange={(v) => set('inflation', v)}
              min={2}
              max={12}
              step={0.5}
              display={`${settings.inflation}%`}
            />
            <Slider
              label="Safe withdrawal rate"
              value={settings.withdrawal_rate}
              onChange={(v) => set('withdrawal_rate', v)}
              min={2.5}
              max={6}
              step={0.25}
              display={`${settings.withdrawal_rate}%`}
              hint="4% is the classic rule; 3.5% is safer for a long Indian retirement."
            />
            <Slider
              label="Emergency fund target"
              value={settings.emergency_months}
              onChange={(v) => set('emergency_months', v)}
              min={1}
              max={24}
              display={`${settings.emergency_months} months`}
            />
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-[12.5px] text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" />
            <p>
              At retirement your expenses become{' '}
              {formatMoney(result.annualExpensesAtRetirement / 12, currency)} a month in
              future rupees. That is why the target looks so large.
            </p>
          </div>

          {dirty ? (
            <Button className="mt-4 w-full" onClick={save} loading={pending}>
              <Save className="size-4" /> Save assumptions
            </Button>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="What moves the date"
          subtitle="Same corpus, one lever changed at a time"
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Change</Th>
              <Th align="right">New FIRE number</Th>
              <Th align="right">Time to FI</Th>
              <Th align="right">Difference</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                <span className="font-medium">Your current plan</span>
              </Td>
              <Td align="right">{formatMoney(result.fiNumberToday, currency)}</Td>
              <Td align="right">
                {result.monthsToFi === null ? '—' : `${(result.monthsToFi / 12).toFixed(1)} yrs`}
              </Td>
              <Td align="right">—</Td>
            </tr>
            {scenarios.map((s) => (
              <tr key={s.label}>
                <Td>{s.label}</Td>
                <Td align="right">{formatMoney(s.fiNumber, currency)}</Td>
                <Td align="right">
                  {s.months === null ? '—' : `${(s.months / 12).toFixed(1)} yrs`}
                </Td>
                <Td align="right">
                  {s.saved === null ? (
                    '—'
                  ) : Math.abs(s.saved) < 1 ? (
                    <span className="text-ink-soft">no change</span>
                  ) : (
                    <span
                      className={
                        s.saved > 0 ? 'font-medium text-good-ink' : 'font-medium text-bad'
                      }
                    >
                      {(Math.abs(s.saved) / 12).toFixed(1)} yrs{' '}
                      {s.saved > 0 ? 'earlier' : 'later'}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
