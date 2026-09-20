import 'server-only';
import { investments } from '@/server/db/mongo';
import { portfolioPipeline } from './pipelines';
import type { Investment } from './schema';

export async function listInvestments(userId: string): Promise<Investment[]> {
  return investments()
    .aggregate<Investment>([
      { $match: { user_id: userId } },
      { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
      {
        $addFields: {
          person_name: { $first: '$__p.name' },
          person_color: { $first: '$__p.color' },
        },
      },
      { $project: { __p: 0 } },
      { $sort: { current_value: -1, name: 1 } },
    ])
    .toArray();
}

export type PortfolioSummary = {
  invested: number;
  current: number;
  gain: number;
  gainPct: number;
  liquidCorpus: number;
  byType: { type: string; invested: number; current: number }[];
  byPerson: {
    person_id: string | null;
    name: string;
    color: string;
    invested: number;
    current: number;
  }[];
};

/**
 * Totals, split by asset type and by whose money it is. One pass over the
 * collection with `$facet`, rather than the three separate SQL queries.
 */
export async function portfolioSummary(userId: string): Promise<PortfolioSummary> {
  const [result] = await investments()
    .aggregate<{
      totals: { invested: number; current: number; liquid: number }[];
      byType: { type: string; invested: number; current: number }[];
      byPerson: {
        person_id: string | null;
        name: string;
        color: string;
        invested: number;
        current: number;
      }[];
    }>(portfolioPipeline(userId))
    .toArray();

  const totals = result?.totals?.[0];
  const invested = totals?.invested ?? 0;
  const current = totals?.current ?? 0;

  return {
    invested,
    current,
    gain: current - invested,
    gainPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
    liquidCorpus: totals?.liquid ?? 0,
    byType: result?.byType ?? [],
    byPerson: result?.byPerson ?? [],
  };
}
