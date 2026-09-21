'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatTile } from '@/components/ui/StatTile';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { GrowthChart, GROWTH_LEGEND } from '@/components/charts/GrowthChart';
import { ShareBar } from '@/components/charts/ShareBar';
import { formatMoney } from '@/lib/money';
import { SERIES } from '@/lib/viz';
import { useReference } from '@/features/settings/ReferenceData';
import { CalculatorsSkeleton } from '@/components/skeletons/PageSkeletons';
import {
  emiSchedule,
  lumpsumFutureValue,
  monthsToTarget,
  sipSeries,
} from '../math';

type Tab = 'sip' | 'lumpsum' | 'emi' | 'goal';

export function CalculatorsView() {
  const { currency, loading, me } = useReference();
  const [tab, setTab] = useState<Tab>('sip');

  if (loading && !me) return <CalculatorsSkeleton />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Calculators</h1>

      </header>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sip' as const, label: 'SIP' },
          { value: 'lumpsum' as const, label: 'Lumpsum' },
          { value: 'emi' as const, label: 'EMI' },
          { value: 'goal' as const, label: 'Goal planner' },
        ]}
      />

      {tab === 'sip' ? <SipCalculator currency={currency} /> : null}
      {tab === 'lumpsum' ? <LumpsumCalculator currency={currency} /> : null}
      {tab === 'emi' ? <EmiCalculator currency={currency} /> : null}
      {tab === 'goal' ? <GoalCalculator currency={currency} /> : null}
    </div>
  );
}

function SipCalculator({ currency }: { currency: string }) {
  const [monthly, setMonthly] = useState(25000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(20);
  const [stepUp, setStepUp] = useState(0);
  const [lumpsum, setLumpsum] = useState(0);

  const series = useMemo(
    () => sipSeries(monthly, rate, years, stepUp, lumpsum),
    [monthly, rate, years, stepUp, lumpsum],
  );
  const last = series.at(-1);
  const invested = last?.invested ?? 0;
  const value = last?.value ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="You put in" value={formatMoney(invested, currency)} />
        <StatTile label="It grows to" value={formatMoney(value, currency)} accent={SERIES[0]} />
        <StatTile
          label="Free money"
          value={formatMoney(value - invested, currency)}
          delta={invested > 0 ? ((value - invested) / invested) * 100 : null}
          sub="from growth alone"
          accent={SERIES[2]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Your SIP" />
          <div className="space-y-5">
            <Slider
              label="Monthly investment"
              value={monthly}
              onChange={setMonthly}
              min={500}
              max={500000}
              step={500}
              display={formatMoney(monthly, currency)}
            />
            <Slider
              label="Expected return"
              value={rate}
              onChange={setRate}
              min={4}
              max={25}
              step={0.5}
              display={`${rate}%`}
            />
            <Slider
              label="Time period"
              value={years}
              onChange={setYears}
              min={1}
              max={40}
              display={`${years} years`}
            />
            <Slider
              label="Yearly step-up"
              value={stepUp}
              onChange={setStepUp}
              min={0}
              max={25}
              display={`${stepUp}%`}
              hint="Raise your SIP with every appraisal. Even 10% a year changes the outcome hugely."
            />
            <Slider
              label="One-time lumpsum at the start"
              value={lumpsum}
              onChange={setLumpsum}
              min={0}
              max={5000000}
              step={10000}
              display={formatMoney(lumpsum, currency)}
            />
          </div>
        </Card>

        <ChartFrame
          title="How it grows"
          legend={GROWTH_LEGEND}
          className="lg:col-span-2"
          height="h-[320px]"
          table={
            <TableWrap>
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th align="right">Invested</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">Gain</Th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.year}>
                    <Td>{s.year}</Td>
                    <Td align="right">{formatMoney(s.invested, currency)}</Td>
                    <Td align="right">{formatMoney(s.value, currency)}</Td>
                    <Td align="right">{formatMoney(s.gain, currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          }
        >
          <GrowthChart data={series} currency={currency} />
        </ChartFrame>
      </div>
    </div>
  );
}

function LumpsumCalculator({ currency }: { currency: string }) {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const value = lumpsumFutureValue(amount, rate, years);
  const series = Array.from({ length: years }, (_, i) => {
    const y = i + 1;
    const v = lumpsumFutureValue(amount, rate, y);
    return { year: y, invested: amount, gain: Math.round(v - amount) };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="You put in" value={formatMoney(amount, currency)} />
        <StatTile label="It grows to" value={formatMoney(value, currency)} accent={SERIES[0]} />
        <StatTile
          label="Free money"
          value={formatMoney(value - amount, currency)}
          delta={((value - amount) / amount) * 100}
          accent={SERIES[2]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="One-time investment" />
          <div className="space-y-5">
            <Slider
              label="Amount"
              value={amount}
              onChange={setAmount}
              min={10000}
              max={20000000}
              step={10000}
              display={formatMoney(amount, currency)}
            />
            <Slider
              label="Expected return"
              value={rate}
              onChange={setRate}
              min={4}
              max={25}
              step={0.5}
              display={`${rate}%`}
            />
            <Slider
              label="Time period"
              value={years}
              onChange={setYears}
              min={1}
              max={40}
              display={`${years} years`}
            />
          </div>
        </Card>

        <ChartFrame
          title="How it grows"
          legend={GROWTH_LEGEND}
          className="lg:col-span-2"
          height="h-[320px]"
        >
          <GrowthChart data={series} currency={currency} />
        </ChartFrame>
      </div>
    </div>
  );
}

function EmiCalculator({ currency }: { currency: string }) {
  const [principal, setPrincipal] = useState(3000000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  const schedule = useMemo(() => emiSchedule(principal, rate, years), [principal, rate, years]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Monthly EMI" value={formatMoney(schedule.payment, currency)} accent={SERIES[0]} />
        <StatTile
          label="Total interest"
          value={formatMoney(schedule.totalInterest, currency)}
          sub={`${((schedule.totalInterest / principal) * 100).toFixed(0)}% of what you borrowed`}
          accent={SERIES[1]}
        />
        <StatTile label="You repay" value={formatMoney(schedule.totalPaid, currency)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Loan details" />
          <div className="space-y-5">
            <Slider
              label="Loan amount"
              value={principal}
              onChange={setPrincipal}
              min={50000}
              max={50000000}
              step={50000}
              display={formatMoney(principal, currency)}
            />
            <Slider
              label="Interest rate"
              value={rate}
              onChange={setRate}
              min={5}
              max={24}
              step={0.05}
              display={`${rate.toFixed(2)}%`}
            />
            <Slider
              label="Tenure"
              value={years}
              onChange={setYears}
              min={1}
              max={30}
              display={`${years} years`}
            />
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-3 text-[13px] font-medium text-ink">Where each rupee goes</p>
            <ShareBar
              currency={currency}
              parts={[
                { label: 'Principal', value: principal, color: SERIES[0] },
                { label: 'Interest', value: schedule.totalInterest, color: SERIES[1] },
              ]}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Year by year" />
          <TableWrap>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th align="right">Principal repaid</Th>
                <Th align="right">Interest paid</Th>
                <Th align="right">Balance left</Th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.year}>
                  <Td>{r.year}</Td>
                  <Td align="right">{formatMoney(r.principalPaid, currency)}</Td>
                  <Td align="right">{formatMoney(r.interestPaid, currency)}</Td>
                  <Td align="right">{formatMoney(r.balance, currency)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}

function GoalCalculator({ currency }: { currency: string }) {
  const [target, setTarget] = useState(2000000);
  const [have, setHave] = useState(200000);
  const [monthly, setMonthly] = useState(20000);
  const [rate, setRate] = useState(12);

  const months = monthsToTarget(have, monthly, rate, target);
  const needed = useMemo(() => {
    // Smallest monthly amount that reaches the target inside 10 years.
    for (let amount = 500; amount <= 1_000_000; amount += 500) {
      const m = monthsToTarget(have, amount, rate, target, 120);
      if (m !== null) return amount;
    }
    return null;
  }, [have, rate, target]);

  const series = months
    ? sipSeries(monthly, rate, Math.ceil(months / 12), 0, have).map((s) => ({
        year: s.year,
        invested: s.invested,
        gain: s.gain,
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Time to reach it"
          value={months === null ? 'Out of reach' : `${(months / 12).toFixed(1)} yrs`}
          sub={months === null ? 'Increase the monthly amount' : `${months} months`}
          accent={SERIES[0]}
        />
        <StatTile label="Target" value={formatMoney(target, currency)} />
        <StatTile
          label="To get there in 10 years"
          value={needed === null ? '—' : `${formatMoney(needed, currency)}/mo`}
          accent={SERIES[2]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Your goal" />
          <div className="space-y-5">
            <Slider
              label="Target amount"
              value={target}
              onChange={setTarget}
              min={50000}
              max={50000000}
              step={50000}
              display={formatMoney(target, currency)}
            />
            <Slider
              label="Already saved"
              value={have}
              onChange={setHave}
              min={0}
              max={20000000}
              step={10000}
              display={formatMoney(have, currency)}
            />
            <Slider
              label="Monthly contribution"
              value={monthly}
              onChange={setMonthly}
              min={0}
              max={500000}
              step={500}
              display={formatMoney(monthly, currency)}
            />
            <Slider
              label="Expected return"
              value={rate}
              onChange={setRate}
              min={0}
              max={20}
              step={0.5}
              display={`${rate}%`}
            />
          </div>
        </Card>

        <ChartFrame
          title="Getting there"
          subtitle={
            months === null
              ? 'Raise the monthly amount until a path appears'
              : `Reaches ${formatMoney(target, currency)} in ${(months / 12).toFixed(1)} years`
          }
          legend={GROWTH_LEGEND}
          className="lg:col-span-2"
          height="h-[320px]"
        >
          <GrowthChart data={series} currency={currency} />
        </ChartFrame>
      </div>
    </div>
  );
}
