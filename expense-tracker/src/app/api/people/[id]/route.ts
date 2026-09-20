import { itemRoutes } from '@/server/crud';
import { peopleCrud } from '@/features/people/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(peopleCrud);
