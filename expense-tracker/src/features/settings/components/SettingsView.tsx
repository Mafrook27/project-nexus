'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, LogOut, Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/States';
import { SettingsSkeleton } from '@/components/skeletons/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { BUCKETS, RELATIONS, labelOf } from '@/lib/constants';
import { SERIES } from '@/lib/viz';
import { useReference } from '@/features/settings/ReferenceData';
import { DevicesCard } from '@/features/devices/components/DevicesCard';
import { RulesCard } from '@/features/transactions/intelligence/components/RulesCard';
import type { Person } from '@/features/people/schema';
import type { Category } from '@/features/categories/schema';

export function SettingsView() {
  const { me, loading } = useReference();
  const router = useRouter();

  if (loading && !me) return <SettingsSkeleton />;

  async function signOut() {
    await api.post('/api/auth/logout');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>

      </header>

      <ProfileCard />
      <DevicesCard />
      <RulesCard />
      <PeopleCard />
      <CategoriesCard />

      <Card>
        <CardHeader title="Your data" subtitle="It is yours, and it leaves as a spreadsheet" />
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?type=transactions" download>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Transactions CSV
            </Button>
          </a>
          <a href="/api/export?type=investments" download>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Investments CSV
            </Button>
          </a>
          <Link href="/fire">
            <Button variant="secondary" size="sm">
              FIRE assumptions
            </Button>
          </Link>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <Button variant="ghost" size="sm" onClick={signOut} className="text-bad hover:bg-bad-soft">
            <LogOut className="size-4" /> Sign out{me ? ` of ${me.email}` : ''}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProfileCard() {
  const { me, refresh } = useReference();
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const [form, setForm] = useState({ name: '', currency: 'INR' });

  useEffect(() => {
    if (me) setForm({ name: me.name, currency: me.currency });
  }, [me]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = await run(() => api.patch('/api/auth/me', form));
    if (saved) {
      toast('Profile updated');
      void refresh();
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" />
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3" noValidate>
        <Field label="Name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Currency">
          <Select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <Input value={me?.email ?? ''} disabled />
        </Field>
        <div className="sm:col-span-3">
          {error ? <p className="mb-2 text-[13px] text-bad">{error}</p> : null}
          <Button type="submit" size="sm" loading={pending}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PeopleCard() {
  const { refresh } = useReference();
  const { toast } = useToast();
  const { run, pending } = useAction();
  const { data, reload } = useResource<Person[]>('/api/people');
  const [form, setForm] = useState({ name: '', relation: 'family' });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const color = SERIES[(data?.length ?? 0) % SERIES.length];
    const saved = await run(() => api.post('/api/people', { ...form, color }));
    if (saved) {
      toast('Person added');
      setForm({ name: '', relation: 'family' });
      void reload();
      void refresh();
    }
  }

  async function remove(person: Person) {
    if (!confirm(`Remove ${person.name}? Their accounts and investments stay but lose the owner.`))
      return;
    const done = await run(() => api.del(`/api/people/${person.id}`));
    if (done) {
      toast('Person removed');
      void reload();
      void refresh();
    }
  }

  return (
    <Card>
      <CardHeader
        title="People"
        subtitle="So you can tag whose money it is"
        action={<Users className="size-4.5 text-ink-muted" />}
      />
      {data?.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {data.map((p) => (
            <li
              key={p.id}
              className="group flex items-center gap-2 rounded-xl border border-line px-3 py-1.5"
            >
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[13px] font-medium text-ink">{p.name}</span>
              <Badge>{labelOf(RELATIONS, p.relation)}</Badge>
              <button
                onClick={() => remove(p)}
                aria-label={`Remove ${p.name}`}
                className="grid size-6 place-items-center rounded-md text-ink-muted opacity-0 transition group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <Field label="Name" className="min-w-[160px] flex-1">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Sister"
          />
        </Field>
        <Field label="Relation" className="w-40">
          <Select
            value={form.relation}
            onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
          >
            {RELATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="md" loading={pending}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </Card>
  );
}

function CategoriesCard() {
  const { refresh } = useReference();
  const { toast } = useToast();
  const { run, pending } = useAction();
  const { data, reload } = useResource<Category[]>('/api/categories');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [form, setForm] = useState({ name: '', bucket: 'personal' as 'home' | 'personal' });

  const list = (data ?? []).filter((c) => c.kind === kind);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const color = SERIES[(data?.length ?? 0) % SERIES.length];
    const saved = await run(() =>
      api.post('/api/categories', { name: form.name, kind, bucket: form.bucket, color }),
    );
    if (saved) {
      toast('Category added');
      setForm({ name: '', bucket: form.bucket });
      void reload();
      void refresh();
    }
  }

  async function remove(category: Category) {
    if (!confirm(`Delete "${category.name}"? Past transactions keep their amounts but lose it.`))
      return;
    const done = await run(() => api.del(`/api/categories/${category.id}`));
    if (done) {
      toast('Category deleted');
      void reload();
      void refresh();
    }
  }

  return (
    <Card>
      <CardHeader
        title="Categories"
        subtitle="Home or personal, so spending adds up correctly"
        action={
          <Segmented
            value={kind}
            onChange={setKind}
            size="sm"
            options={[
              { value: 'expense' as const, label: 'Expense' },
              { value: 'income' as const, label: 'Income' },
            ]}
          />
        }
      />

      {list.length ? (
        <ul className="mb-4 flex flex-wrap gap-2">
          {list.map((c) => (
            <li
              key={c.id}
              className="group flex items-center gap-2 rounded-xl border border-line px-3 py-1.5"
            >
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-[13px] font-medium text-ink">{c.name}</span>
              <span className="text-[11.5px] text-ink-muted">
                {c.bucket === 'home' ? 'Home' : 'Personal'}
              </span>
              <button
                onClick={() => remove(c)}
                aria-label={`Delete ${c.name}`}
                className="grid size-6 place-items-center rounded-md text-ink-muted opacity-0 transition group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No categories of this kind yet" />
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <Field label="New category" className="min-w-[160px] flex-1">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Pet care"
          />
        </Field>
        <Field label="Bucket" className="w-44">
          <Segmented
            value={form.bucket}
            onChange={(v) => setForm((f) => ({ ...f, bucket: v }))}
            options={BUCKETS}
            className="h-10 w-full [&>button]:flex-1"
          />
        </Field>
        <Button type="submit" size="md" loading={pending}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </Card>
  );
}
