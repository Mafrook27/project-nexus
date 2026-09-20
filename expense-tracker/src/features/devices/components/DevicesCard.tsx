'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Smartphone, Trash2, TriangleAlert } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { Device } from '../schema';

/**
 * Phones allowed to post transactions. The token is shown once, at pairing,
 * and never again - the server only keeps its hash.
 */
export function DevicesCard() {
  const { toast } = useToast();
  const { run, pending } = useAction();
  const { data, reload } = useResource<Device[]>('/api/devices');
  const [form, setForm] = useState({ name: '', platform: 'android' });
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const result = await run(() =>
      api.post<{ id: string; name: string; token: string }>('/api/devices', form),
    );
    if (result) {
      setIssued({ name: result.name, token: result.token });
      setForm({ name: '', platform: 'android' });
      void reload();
    }
  }

  async function revoke(device: Device) {
    if (!confirm(`Revoke "${device.name}"? It will stop being able to send transactions.`)) return;
    const done = await run(() => api.del(`/api/devices/${device.id}`));
    if (done) {
      toast('Device revoked');
      void reload();
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast('Token copied');
    } catch {
      toast('Copy it by hand - the clipboard was blocked', 'error');
    }
  }

  const devices = data ?? [];

  return (
    <Card>
      <CardHeader
        title="Connected phones"
        subtitle="A paired phone can send spends it spots, and nothing else"
        action={
          <Link href="/sms-test" className="text-[12.5px] font-medium text-brand hover:underline">
            Test a message
          </Link>
        }
      />

      {devices.length ? (
        <ul className="mb-4 divide-y divide-line">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                <Smartphone className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{d.name}</p>
                <p className="truncate text-[12px] text-ink-muted">
                  {d.revoked_at
                    ? `Revoked ${formatDate(d.revoked_at)}`
                    : d.last_seen_at
                      ? `Last sent ${formatDate(d.last_seen_at)} · ${d.synced_count} spends`
                      : 'Paired, nothing sent yet'}
                </p>
              </div>
              {d.revoked_at ? <Badge>Revoked</Badge> : <Badge tone="good">Active</Badge>}
              {!d.revoked_at ? (
                <button
                  onClick={() => revoke(d)}
                  aria-label={`Revoke ${d.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No phone paired"
          description="Pair one to have bank messages turn into spends by themselves."
        />
      )}

      <form onSubmit={pair} className="flex flex-wrap items-end gap-2">
        <Field label="Phone name" className="min-w-[160px] flex-1">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Pixel"
          />
        </Field>
        <Field label="Kind" className="w-36">
          <Select
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
          >
            <option value="android">Android</option>
            <option value="ios">iPhone</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Button type="submit" loading={pending}>
          Pair
        </Button>
      </form>

      <Modal
        open={Boolean(issued)}
        onClose={() => setIssued(null)}
        title="Copy this token now"
        description="It is shown once. Close this and it is gone for good."
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-[#7a5200]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Anyone holding this token can add spends to your account. Paste it into the companion
              app on <span className="font-medium">{issued?.name}</span> and nowhere else.
            </span>
          </p>
          <pre className="num-mono overflow-x-auto rounded-xl border border-line bg-surface-sunken px-3 py-3 text-[12px] break-all whitespace-pre-wrap text-ink">
            {issued?.token}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => copy(issued!.token)}>
              <Copy className="size-4" /> Copy
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
