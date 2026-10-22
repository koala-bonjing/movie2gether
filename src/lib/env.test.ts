import { describe, it, expect } from 'vitest';
import { cleanSupabaseUrlString } from './env';

describe('cleanSupabaseUrlString', () => {
  it('returns undefined for empty, whitespace, or non-string inputs', () => {
    expect(cleanSupabaseUrlString('')).toBeUndefined();
    expect(cleanSupabaseUrlString('   ')).toBeUndefined();
    expect(cleanSupabaseUrlString(undefined)).toBeUndefined();
    expect(cleanSupabaseUrlString(null)).toBeUndefined();
  });

  it('preserves clean project origin without subpaths', () => {
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
  });

  it('strips trailing slashes from project URL', () => {
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co///')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
  });

  it('strips /rest/v1 and subpaths to prevent "Invalid path specified in request URL" errors', () => {
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/rest/v1')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/rest/v1/')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/rest/v1/rooms')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
  });

  it('strips /auth/v1 and /realtime/v1 subpaths', () => {
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/auth/v1')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
    expect(cleanSupabaseUrlString('https://jhxqdyxogkzosiihlnxx.supabase.co/realtime/v1')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
  });

  it('handles missing protocol and custom ports correctly', () => {
    expect(cleanSupabaseUrlString('jhxqdyxogkzosiihlnxx.supabase.co/rest/v1')).toBe(
      'https://jhxqdyxogkzosiihlnxx.supabase.co',
    );
    expect(cleanSupabaseUrlString('http://localhost:54321/rest/v1')).toBe(
      'http://localhost:54321',
    );
  });
});
