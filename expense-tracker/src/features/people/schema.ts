import { z } from 'zod';
import { RELATIONS } from '@/lib/constants';
import { zEnum, zText } from '@/lib/validation';

export const personSchema = z.object({
  name: zText(60),
  relation: zEnum(RELATIONS).default('self'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4C6EF5'),
});
export const personUpdateSchema = personSchema.partial();

export type Person = {
  id: string;
  name: string;
  relation: string;
  color: string;
  created_at: string;
};
