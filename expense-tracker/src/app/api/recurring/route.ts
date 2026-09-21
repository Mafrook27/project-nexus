import { collectionRoutes } from '@/server/crud';
import { recurringCrud } from '@/features/recurring/crud';

export const runtime = 'nodejs';
export const { GET, POST } = collectionRoutes(recurringCrud);
