import { itemRoutes } from '@/server/crud';
import { accountsCrud } from '@/features/accounts/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(accountsCrud);
