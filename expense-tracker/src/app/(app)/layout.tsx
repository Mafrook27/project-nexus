import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/features/auth/session';
import { ReferenceDataProvider } from '@/features/settings/ReferenceData';
import { AppShell } from '@/components/layout/AppShell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Middleware only checks that a cookie exists; this verifies the signature.
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <ReferenceDataProvider>
      <AppShell>{children}</AppShell>
    </ReferenceDataProvider>
  );
}
