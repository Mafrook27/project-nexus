import { collectionRoutes } from '@/server/crud';
import { sipsCrud } from '@/features/sips/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(sipsCrud);
