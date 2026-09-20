import { itemRoutes } from '@/server/crud';
import { recurringCrud } from '@/features/recurring/crud';

export const runtime = 'nodejs';
export const { GET, PATCH, DELETE } = itemRoutes(recurringCrud);
