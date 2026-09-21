import { collectionRoutes } from '@/server/crud';
import { categoriesCrud } from '@/features/categories/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(categoriesCrud);
