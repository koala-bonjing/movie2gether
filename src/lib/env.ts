import { z } from 'zod';

// Empty strings from .env count as "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

// Clean and sanitize Supabase URL (strip any subpath or trailing slash to guarantee root project origin)
export const cleanSupabaseUrlString = (val: unknown): string | undefined => {
  if (typeof val !== 'string' || val.trim() === '') return undefined;
  const trimmed = val.trim();
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/(rest|auth|realtime)\/v1.*$/i, '').replace(/\/+$/, '');
  }
};

const schema = z.object({
  // Optional until Phase 2 wires Supabase; tighten to required then.
  VITE_SUPABASE_URL: z.preprocess(cleanSupabaseUrlString, z.string().url().optional()),
  VITE_SUPABASE_ANON_KEY: optional(z.string()),
  VITE_STUN_URLS: z
    .string()
    .default('stun:stun.l.google.com:19302')
    .transform((s) => s.split(',').map((u) => u.trim()).filter(Boolean)),
  VITE_TURN_URL: optional(z.string()),
  VITE_TURN_USER: optional(z.string()),
  VITE_TURN_CRED: optional(z.string()),
});

export const env = schema.parse(import.meta.env);
