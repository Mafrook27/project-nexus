import { collectionRoutes } from '@/server/crud';
import { goalsCrud } from '@/features/goals/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(goalsCrud);
