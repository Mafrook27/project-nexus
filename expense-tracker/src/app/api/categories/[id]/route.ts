import { itemRoutes } from '@/server/crud';
import { categoriesCrud } from '@/features/categories/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(categoriesCrud);
