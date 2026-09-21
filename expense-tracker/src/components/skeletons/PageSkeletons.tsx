import {
  Skeleton,
  SkeletonBars,
  SkeletonCard,
  SkeletonChart,
  SkeletonHeader,
  SkeletonMeters,
  SkeletonPageHeader,
  SkeletonRows,
  SkeletonSliders,
  SkeletonStatRow,
  SkeletonTable,
} from '@/components/ui/Skeleton';

/**
 * One skeleton per screen, laid out exactly like the screen it stands in for.
 * These are used twice: as the route-level `loading.tsx` while Next.js streams
 * the page in, and inside each view while its first fetch is in flight.
 */

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-xl" />
      </div>

      {/* Cash flow + leaks */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <SkeletonCard>
          <SkeletonHeader />
          <Skeleton className="mt-1 h-10 w-56 rounded-lg" />
          <Skeleton className="mt-2.5 h-3 w-36 rounded" />
          <Skeleton className="mt-5 h-3 w-full rounded-full" />
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="mt-2 h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard>
          <SkeletonHeader />
          <Skeleton className="mt-1 h-8 w-32 rounded-lg" />
          <Skeleton className="mt-2.5 h-3 w-52 rounded" />
          <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <Skeleton className="h-3 w-28 rounded" />
            <div className="mt-3 space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-32 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      </div>

      <SkeletonStatRow />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <SkeletonCard className="lg:col-span-2">
          <SkeletonHeader />
          <SkeletonBars rows={7} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <Skeleton className="h-3 w-32 rounded" />
            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      </div>

      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonChart />
      </SkeletonCard>

      <div className="skeleton-stagger grid gap-4 lg:grid-cols-3 lg:items-start">
        <SkeletonCard>
          <SkeletonHeader />
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <Skeleton className="mt-3 h-3 w-48 rounded" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader />
          <SkeletonMeters rows={5} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader />
          <SkeletonRows rows={3} divided={false} />
        </SkeletonCard>
      </div>

      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonRows rows={6} />
      </SkeletonCard>
    </div>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="mt-2 h-3.5 w-64 rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <SkeletonCard>
        <SkeletonRows rows={12} />
      </SkeletonCard>
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <div className="skeleton-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="mt-3 h-4 w-32 rounded" />
            <Skeleton className="mt-2 h-2.5 w-40 rounded" />
            <Skeleton className="mt-4 h-6 w-28 rounded-md" />
            <Skeleton className="mt-3 h-5 w-24 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function InvestmentsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatRow />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-8 w-56 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonBars rows={6} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <SkeletonTable rows={3} cols={4} />
          </div>
        </SkeletonCard>
      </div>
      <SkeletonCard>
        <SkeletonHeader action={false} />
        <SkeletonTable rows={8} cols={6} />
      </SkeletonCard>
    </div>
  );
}

export function StocksSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatRow />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonBars rows={5} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <Skeleton className="h-2.5 w-24 rounded" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <Skeleton className="h-2.5 w-28 rounded" />
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      </div>
      <SkeletonCard>
        <SkeletonHeader action={false} />
        <SkeletonTable rows={6} cols={7} />
      </SkeletonCard>
    </div>
  );
}

export function BudgetsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-7 w-24 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <SkeletonCard key={col}>
            <SkeletonHeader action={false} />
            <ul className="space-y-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-2.5 shrink-0 rounded-full" />
                    <Skeleton className="h-3.5 flex-1 rounded" />
                    <Skeleton className="h-9 w-32 shrink-0 rounded-xl" />
                  </div>
                  {i % 2 === 0 ? <Skeleton className="mt-2 h-2 w-full rounded-full" /> : null}
                </li>
              ))}
            </ul>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function BillsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="mt-3 h-7 w-24 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonRows rows={4} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonHeader action={false} />
        <SkeletonTable rows={3} cols={6} />
      </SkeletonCard>
    </div>
  );
}

export function GoalsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <div className="skeleton-stagger grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="mt-2 h-2.5 w-32 rounded" />
            <Skeleton className="mt-4 h-6 w-48 rounded-md" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-56 rounded" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function FireSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-64 rounded-lg" />
        <Skeleton className="mt-2.5 h-3.5 w-96 max-w-full rounded" />
      </div>
      <SkeletonStatRow />
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <SkeletonCard className="lg:col-span-2">
          <SkeletonHeader />
          <SkeletonChart height="h-[300px]" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonMeters rows={5} />
        </SkeletonCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonHeader action={false} />
            <SkeletonSliders rows={5} />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonHeader action={false} />
        <SkeletonTable rows={5} cols={4} />
      </SkeletonCard>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatRow />
      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonChart height="h-[300px]" />
      </SkeletonCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonChart height="h-[240px]" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonBars rows={6} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonTable rows={8} cols={4} />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function CalculatorsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-44 rounded-lg" />
      <Skeleton className="h-9 w-72 rounded-xl" />
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard>
          <SkeletonHeader action={false} />
          <SkeletonSliders rows={5} />
        </SkeletonCard>
        <SkeletonCard className="lg:col-span-2">
          <SkeletonHeader />
          <SkeletonChart height="h-[320px]" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-36 rounded-lg" />
      <SkeletonCard>
        <SkeletonHeader action={false} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="mt-2 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-8 w-28 rounded-lg" />
      </SkeletonCard>
      {[0, 1].map((card) => (
        <SkeletonCard key={card}>
          <SkeletonHeader />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: card === 0 ? 3 : 10 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-32 rounded-xl" />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="mt-2.5 h-3.5 w-80 max-w-full rounded" />
      </div>
      <div className="skeleton-stagger space-y-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Skeleton className="h-2.5 w-32 rounded" />
                <Skeleton className="mt-3 h-8 w-36 rounded-lg" />
                <Skeleton className="mt-3 h-3.5 w-28 rounded" />
                <Skeleton className="mt-2 h-2.5 w-52 rounded" />
              </div>
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="mt-5 h-3 w-48 rounded" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 9 }, (_, c) => (
                <Skeleton key={c} className="h-8 w-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-5 h-3 w-32 rounded" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((c) => (
                <Skeleton key={c} className="h-9 rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-5 h-10 w-full rounded-xl" />
            <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function SipSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonChart height="h-[260px]" />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonHeader />
        <SkeletonRows rows={4} />
      </SkeletonCard>
    </div>
  );
}
