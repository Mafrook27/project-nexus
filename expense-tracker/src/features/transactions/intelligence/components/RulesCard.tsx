'use client';

import { Sparkles, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';

type Rule = {
  id: string;
  pattern: string;
  match_type: string;
  category_name: string | null;
  category_color: string | null;
  need_level: string | null;
  auto_confirm: boolean;
  hits: number;
};

/**
 * What the app has learned. Every row here is a question it will never ask you
 * again, so this doubles as a record of how much noise you have removed.
 */
export function RulesCard() {
  const { toast } = useToast();
  const { run } = useAction();
  const { data, reload } = useResource<Rule[]>('/api/transaction-rules');

  async function remove(rule: Rule) {
    if (!confirm(`Forget the rule for "${rule.pattern}"? You will be asked about it again.`))
      return;
    const done = await run(() => api.del(`/api/transaction-rules/${rule.id}`));
    if (done) {
      toast('Rule removed');
      void reload();
    }
  }

  const rules = data ?? [];

  return (
    <Card>
      <CardHeader
        title="What the app has learned"
        subtitle="Merchants it sorts for you, so it stops asking"
        action={<Sparkles className="size-4.5 text-ink-muted" />}
      />
      {rules.length ? (
        <ul className="divide-y divide-line">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 text-[13.5px]">
                <span className="font-medium text-ink">{rule.pattern}</span>
                <span className="mx-1.5 text-ink-muted">&rarr;</span>
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  {rule.category_color ? (
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: rule.category_color }}
                    />
                  ) : null}
                  {rule.category_name ?? 'no category'}
                </span>
              </span>
              {rule.hits > 0 ? (
                <Badge>
                  {rule.hits} {rule.hits === 1 ? 'time' : 'times'}
                </Badge>
              ) : null}
              {!rule.auto_confirm ? <Badge tone="warn">Still asks</Badge> : null}
              <button
                onClick={() => remove(rule)}
                aria-label={`Forget ${rule.pattern}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing learned yet"
          description="Answer a spend in Needs a look and tick &ldquo;always sort this way&rdquo;. It will appear here."
        />
      )}
    </Card>
  );
}
