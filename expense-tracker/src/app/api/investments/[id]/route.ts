import { itemRoutes } from '@/server/crud';
import { investmentsCrud } from '@/features/investments/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(investmentsCrud);
