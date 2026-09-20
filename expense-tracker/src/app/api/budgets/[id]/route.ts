import { itemRoutes } from '@/server/crud';
import { budgetsCrud } from '@/features/budgets/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(budgetsCrud);
