'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Send, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { labelOf } from '@/lib/constants';
import { PAYMENT_METHODS } from '@/lib/intelligence';
import { useReference } from '@/features/settings/ReferenceData';
import { parseBankMessage } from '../../parsers';
import { SAMPLE_MESSAGES } from '../samples';

/**
 * Paste a bank message, see exactly what the app makes of it.
 *
 * The parser has no server, React or database imports, so it runs right here
 * in the browser and the result updates as you type. "Send it through" then
 * posts the same message to the real sync endpoint, so you can watch it land
 * in Needs a look without an Android app, a device token or curl.
 */
export function SmsTester() {
  const { currency, refresh } = useReference();
  const { toast } = useToast();
  const { run, pending } = useAction();

  const [sender, setSender] = useState('AD-IPPBNK');
  const [body, setBody] = useState(SAMPLE_MESSAGES[0].body);
  const [sent, setSent] = useState<string | null>(null);

  const parsed = useMemo(
    () => (body.trim() ? parseBankMessage(body, sender.trim() || undefined) : null),
    [body, sender],
  );

  async function send() {
    const result = await run(() =>
      api.post<{ created: number; duplicates: number; skipped: number }>(
        '/api/transactions/sync',
        { source: 'sms', sender: sender.trim() || undefined, message: body },
      ),
    );
    if (result) {
      const outcome = result.created
        ? 'Added. Find it in Needs a look.'
        : result.duplicates
          ? 'Recognised as a duplicate of one you already have.'
          : 'Rejected. This is not a transaction message.';
      setSent(outcome);
      toast(outcome);
      void refresh();
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Test a bank message</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
          Paste a real SMS from your bank and see what the app reads from it. Nothing is saved
          until you press send.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="The message" />
          <div className="space-y-4">
            <Field label="Sender id" hint="The short code the SMS came from, e.g. AD-IPPBNK">
              <Input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="AD-IPPBNK"
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSent(null);
                }}
                rows={5}
                placeholder="Paste the whole SMS here"
              />
            </Field>
            <Button onClick={send} loading={pending} disabled={!parsed}>
              <Send className="size-4" /> Send it through for real
            </Button>
            {sent ? (
              <p className="rounded-xl bg-brand-soft px-3 py-2.5 text-[13px] text-brand-strong">
                {sent}{' '}
                <Link href="/review" className="font-medium underline underline-offset-2">
                  Open Needs a look
                </Link>
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="What the app reads" />
          {parsed ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-good" />
                <span className="text-[13.5px] font-medium text-good-ink">
                  Read as a {parsed.direction === 'credit' ? 'payment received' : 'spend'}
                </span>
                <Badge tone="brand">{parsed.parser}</Badge>
              </div>
              <dl className="divide-y divide-line">
                <Row label="Amount" value={formatMoney(parsed.amount, currency)} strong />
                <Row
                  label="Direction"
                  value={parsed.direction === 'credit' ? 'Money in' : 'Money out'}
                />
                <Row label="Paid to" value={parsed.merchant ?? 'not named'} />
                <Row label="How" value={labelOf(PAYMENT_METHODS, parsed.paymentMethod)} />
                <Row label="Account" value={parsed.accountLast4 ? `····${parsed.accountLast4}` : '—'} />
                <Row label="Bank reference" value={parsed.reference ?? '—'} />
                <Row
                  label="When"
                  value={
                    parsed.transactionAt
                      ? new Date(parsed.transactionAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'no date in the message, the phone clock is used'
                  }
                />
                <Row
                  label="Confidence"
                  value={`${Math.round(parsed.confidence * 100)}%`}
                  hint={
                    parsed.confidence < 0.5
                      ? 'Below 50%, so a saved rule will not sort it silently'
                      : undefined
                  }
                />
              </dl>
            </>
          ) : body.trim() ? (
            <div className="flex items-start gap-2 rounded-xl bg-good-soft px-3 py-3 text-[13px] text-good-ink">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block font-medium">Rejected, and that is correct behaviour</span>
                This is a one-time password, a balance alert, a promotion, or something that has
                not happened yet. It will never become a spend.
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">Paste a message to see the result.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Try one of these"
          subtitle="Real formats from IPPB, CUB, SBI and IOB. The last four must be rejected."
        />
        <ul className="divide-y divide-line">
          {SAMPLE_MESSAGES.map((sample) => (
            <li key={sample.body}>
              <button
                onClick={() => {
                  setSender(sample.sender);
                  setBody(sample.body);
                  setSent(null);
                }}
                className="group flex w-full items-start gap-3 py-3 text-left"
              >
                <Badge
                  tone={
                    sample.expect === 'rejected'
                      ? 'bad'
                      : sample.expect === 'income'
                        ? 'good'
                        : 'brand'
                  }
                  className="mt-0.5 shrink-0"
                >
                  {sample.bank}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink-soft group-hover:text-ink">
                    {sample.body}
                  </span>
                  {sample.note ? (
                    <span className="mt-0.5 block text-[12px] text-ink-muted">{sample.note}</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[12.5px] font-medium',
                    sample.expect === 'rejected' ? 'text-bad' : 'text-good-ink',
                  )}
                >
                  {sample.expect === 'rejected' ? 'must reject' : 'must read'}
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-muted opacity-0 transition group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right">
        <span
          className={cn(
            'num-mono block truncate',
            strong ? 'text-[16px] font-semibold text-ink' : 'text-[13.5px] text-ink',
          )}
        >
          {value}
        </span>
        {hint ? <span className="block text-[12px] text-warn">{hint}</span> : null}
      </dd>
    </div>
  );
}
