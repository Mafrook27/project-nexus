import { Suspense } from 'react';
import { TransactionsView } from '@/features/transactions/components/TransactionsView';

export const metadata = { title: 'Money in & out' };

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsView />
    </Suspense>
  );
}
