import { collectionRoutes } from '@/server/crud';
import { investmentsCrud } from '@/features/investments/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(investmentsCrud);
