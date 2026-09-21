'use client';

import Link from 'next/link';
import { Inbox, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNote } from '@/components/ui/States';
import { ReviewSkeleton } from '@/components/skeletons/PageSkeletons';
import { useResource } from '@/hooks/useResource';
import { useReference } from '@/features/settings/ReferenceData';
import { ReviewCard } from './ReviewCard';
import type { Transaction } from '../schema';

/**
 * The queue of automatically detected payments that still need a human answer.
 * Deliberately a list rather than a one-at-a-time wizard: you can see how much
 * is waiting, and answer the easy ones first.
 */
export function ReviewView() {
  const { categories, currency, refresh } = useReference();
  const { data, error, loading, reload } = useResource<{
    rows: Transaction[];
    count: number;
    topCategoryIds: string[];
  }>('/api/transactions/review');

  function afterAnswer() {
    void reload();
    void refresh();
  }

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <ReviewSkeleton />;

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Needs a look</h1>
        {rows.length ? (
          <p className="mt-1 text-[13.5px] text-ink-soft">
            <span className="font-semibold text-ink">{rows.length}</span>{' '}
            {rows.length === 1 ? 'spend' : 'spends'} came in on their own. Tell the app what they
            were and it will remember.
          </p>
        ) : null}
      </header>

      {rows.length ? (
        <div className="space-y-4">
          {rows.map((txn) => (
            <ReviewCard
              key={txn.id}
              txn={txn}
              categories={categories}
              topCategoryIds={data?.topCategoryIds ?? []}
              currency={currency}
              onDone={afterAnswer}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Nothing waiting"
            description="When your phone spots a bank message, the spend lands here for you to name. Pair your phone in Settings to switch that on."
            action={
              <Link href="/settings">
                <Button size="sm" variant="secondary">
                  <Smartphone className="size-4" /> Pair a phone
                </Button>
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}
