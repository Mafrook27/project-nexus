import 'server-only';
import { query } from '@/server/db/client';
import type { Investment } from './schema';

export async function listInvestments(userId: string): Promise<Investment[]> {
  return query<Investment>(
    `SELECT i.*, p.name AS person_name, p.color AS person_color
     FROM investments i
     LEFT JOIN people p ON p.id = i.person_id
     WHERE i.user_id = $1
     ORDER BY i.current_value DESC, i.name ASC`,
    [userId],
  );
}

export type PortfolioSummary = {
  invested: number;
  current: number;
  gain: number;
  gainPct: number;
  liquidCorpus: number;
  byType: { type: string; invested: number; current: number }[];
  byPerson: { person_id: string | null; name: string; color: string; invested: number; current: number }[];
};

export async function portfolioSummary(userId: string): Promise<PortfolioSummary> {
  const [totals] = await query<{ invested: number; current: number; liquid: number }>(
    `SELECT COALESCE(SUM(invested), 0)      AS invested,
            COALESCE(SUM(current_value), 0) AS current,
            COALESCE(SUM(CASE WHEN liquid THEN current_value ELSE 0 END), 0) AS liquid
     FROM investments WHERE user_id = $1`,
    [userId],
  );
  const byType = await query<{ type: string; invested: number; current: number }>(
    `SELECT type,
            COALESCE(SUM(invested), 0) AS invested,
            COALESCE(SUM(current_value), 0) AS current
     FROM investments WHERE user_id = $1
     GROUP BY type ORDER BY current DESC`,
    [userId],
  );
  const byPerson = await query<{
    person_id: string | null;
    name: string;
    color: string;
    invested: number;
    current: number;
  }>(
    `SELECT i.person_id,
            COALESCE(p.name, 'Unassigned')  AS name,
            COALESCE(p.color, '#94A3B8')    AS color,
            COALESCE(SUM(i.invested), 0)      AS invested,
            COALESCE(SUM(i.current_value), 0) AS current
     FROM investments i
     LEFT JOIN people p ON p.id = i.person_id
     WHERE i.user_id = $1
     GROUP BY i.person_id, p.name, p.color
     ORDER BY current DESC`,
    [userId],
  );
  const invested = totals?.invested ?? 0;
  const current = totals?.current ?? 0;
  return {
    invested,
    current,
    gain: current - invested,
    gainPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
    liquidCorpus: totals?.liquid ?? 0,
    byType,
    byPerson,
  };
}
