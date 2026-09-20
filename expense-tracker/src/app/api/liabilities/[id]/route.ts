import { itemRoutes } from '@/server/crud';
import { liabilitiesCrud } from '@/features/liabilities/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(liabilitiesCrud);
