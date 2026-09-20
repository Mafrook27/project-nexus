import { itemRoutes } from '@/server/crud';
import { merchantRulesCrud } from '@/features/transactions/intelligence/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(merchantRulesCrud);
