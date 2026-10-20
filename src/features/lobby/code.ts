/**
 * Room code generation and validation (ARCHITECTURE.md §11).
 * Unguessable 6-character code using alphabet without ambiguous characters (0, O, 1, I).
 * Regex: ^[A-HJ-NP-Z2-9]{6}$
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return CODE_REGEX.test(code.trim().toUpperCase());
}

export function sanitizeRoomCode(raw: string): string {
  // Uppercase and strip invalid characters
  return raw
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, '')
    .slice(0, 6);
}

const STORAGE_KEY_NAME = 'duet:display-name';

export function getStoredDisplayName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_NAME) || '';
  } catch {
    return '';
  }
}

export function setStoredDisplayName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_NAME, name.trim().slice(0, 40));
  } catch {
    // ignore
  }
}
