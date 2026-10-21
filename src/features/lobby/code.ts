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

export function applyOtpInput(
  currentCode: string,
  index: number,
  inputVal: string,
  length = 6,
): { nextCode: string; nextIndex: number } {
  const chars = Array.from({ length }, (_, i) => currentCode[i] || '');

  // 1. Cleared slot (backspace on mobile keyboard / selection delete)
  if (!inputVal) {
    chars[index] = '';
    return {
      nextCode: chars.join(''),
      nextIndex: Math.max(0, index - 1),
    };
  }

  const sanitized = sanitizeRoomCode(inputVal);
  if (!sanitized) {
    chars[index] = '';
    return {
      nextCode: chars.join(''),
      nextIndex: index,
    };
  }

  if (sanitized.length === 1) {
    chars[index] = sanitized;
    return {
      nextCode: chars.join(''),
      nextIndex: Math.min(index + 1, length - 1),
    };
  }

  const oldChar = chars[index];
  if (sanitized.length === 2 && oldChar && (sanitized[0] === oldChar || sanitized[1] === oldChar)) {
    // User typed a character over an existing slot
    const incoming = sanitized[0] === oldChar ? sanitized[1] : sanitized[0];
    chars[index] = incoming || sanitized[1] || '';
    return {
      nextCode: chars.join(''),
      nextIndex: Math.min(index + 1, length - 1),
    };
  }

  // Multi-character entry (paste / autofill)
  const startIdx = sanitized.length >= length ? 0 : index;
  for (let j = 0; j < sanitized.length && startIdx + j < length; j++) {
    chars[startIdx + j] = sanitized[j] || '';
  }
  return {
    nextCode: chars.join('').slice(0, length),
    nextIndex: Math.min(startIdx + sanitized.length, length - 1),
  };
}

const memStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memStore.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
  memStore.set(key, value);
}

const STORAGE_KEY_NAME = 'duet:display-name';

export function getStoredDisplayName(): string {
  return getStorageItem(STORAGE_KEY_NAME) || '';
}

export function setStoredDisplayName(name: string): void {
  setStorageItem(STORAGE_KEY_NAME, name.trim().slice(0, 40));
}

const STORAGE_KEY_RECENT_ROOM = 'duet:recent-room';

export interface RecentRoom {
  code: string;
  name?: string;
  at: number;
}

export function getRecentRoom(): RecentRoom | null {
  try {
    const raw = getStorageItem(STORAGE_KEY_RECENT_ROOM);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'string' && isValidRoomCode(parsed.code)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setRecentRoom(code: string, name?: string): void {
  try {
    if (!isValidRoomCode(code)) return;
    setStorageItem(
      STORAGE_KEY_RECENT_ROOM,
      JSON.stringify({ code: code.toUpperCase(), name: name?.trim() || '', at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

