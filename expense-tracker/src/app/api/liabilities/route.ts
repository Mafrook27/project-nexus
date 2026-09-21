import { collectionRoutes } from '@/server/crud';
import { liabilitiesCrud } from '@/features/liabilities/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(liabilitiesCrud);
