import { collectionRoutes } from '@/server/crud';
import { budgetsCrud } from '@/features/budgets/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(budgetsCrud);
