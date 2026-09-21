import { z } from 'zod';
import { zText } from '@/lib/validation';

export const deviceSchema = z.object({
  name: zText(60),
  platform: z.enum(['android', 'ios', 'other']).default('android'),
});

export type Device = {
  id: string;
  name: string;
  platform: string;
  last_seen_at: string | null;
  synced_count: number;
  revoked_at: string | null;
  created_at: string;
};
