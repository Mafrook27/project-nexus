import { collectionRoutes } from '@/server/crud';
import { accountsCrud } from '@/features/accounts/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(accountsCrud);
