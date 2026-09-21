import clsx, { type ClassValue } from 'clsx';

/** Tiny class-name joiner used by every UI primitive. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
