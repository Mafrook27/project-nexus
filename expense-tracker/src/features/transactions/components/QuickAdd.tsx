'use client';

import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { TransactionForm } from './TransactionForm';

/** The one-tap capture flow reachable from every screen. */
export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();

  return (
    <Modal open={open} onClose={onClose} title="Add transaction">
      <TransactionForm
        onSaved={(_saved, keepOpen) => {
          toast('Transaction saved');
          router.refresh();
          if (!keepOpen) onClose();
        }}
        onCancel={onClose}
        submitLabel="Save"
      />
    </Modal>
  );
}
