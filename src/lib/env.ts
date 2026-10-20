import { z } from 'zod';

// Empty strings from .env count as "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const schema = z.object({
  // Optional until Phase 2 wires Supabase; tighten to required then.
  VITE_SUPABASE_URL: optional(z.url()),
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
