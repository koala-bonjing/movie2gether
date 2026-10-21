import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  isValidRoomCode,
  sanitizeRoomCode,
  applyOtpInput,
  getRecentRoom,
  setRecentRoom,
  CODE_REGEX,
  CODE_ALPHABET,
} from './code';

describe('room code generation and validation', () => {
  it('generates a 6-character code matching the regex and alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(CODE_REGEX);
      for (const char of code) {
        expect(CODE_ALPHABET).toContain(char);
        expect(['0', 'O', '1', 'I']).not.toContain(char);
      }
    }
  });

  it('validates correct room codes', () => {
    expect(isValidRoomCode('ABCDEF')).toBe(true);
    expect(isValidRoomCode('234567')).toBe(true);
    expect(isValidRoomCode('X9ZK72')).toBe(true);
  });

  it('rejects codes with invalid characters or incorrect length', () => {
    expect(isValidRoomCode('ABCD01')).toBe(false); // contains 0 and 1
    expect(isValidRoomCode('ABCDEI')).toBe(false); // contains I
    expect(isValidRoomCode('ABCDEO')).toBe(false); // contains O
    expect(isValidRoomCode('ABCDE')).toBe(false); // 5 chars
    expect(isValidRoomCode('ABCDEFG')).toBe(false); // 7 chars
    expect(isValidRoomCode('')).toBe(false);
  });

  it('sanitizes input strings correctly', () => {
    expect(sanitizeRoomCode('abc def')).toBe('ABCDEF');
    expect(sanitizeRoomCode('x-9_z:k?72!')).toBe('X9ZK72');
    expect(sanitizeRoomCode('abcdefghijk')).toBe('ABCDEF'); // max 6 chars
    expect(sanitizeRoomCode('01IOxyz')).toBe('XYZ'); // strips 0, 1, I, O
  });

  it('handles applyOtpInput digit entry, replacement, backspace, and paste', () => {
    // 1. Single character entry into empty slot
    expect(applyOtpInput('', 0, 'a', 6)).toEqual({ nextCode: 'A', nextIndex: 1 });
    expect(applyOtpInput('A', 1, 'b', 6)).toEqual({ nextCode: 'AB', nextIndex: 2 });

    // 2. Character replacement in already filled slot
    expect(applyOtpInput('AB3456', 0, 'AZ', 6)).toEqual({ nextCode: 'ZB3456', nextIndex: 1 });
    expect(applyOtpInput('AB3456', 0, 'ZA', 6)).toEqual({ nextCode: 'ZB3456', nextIndex: 1 });

    // 3. Slot deletion / mobile backspace
    expect(applyOtpInput('ABC123', 1, '', 6)).toEqual({ nextCode: 'AC123', nextIndex: 0 });

    // 4. Paste full code
    expect(applyOtpInput('', 0, 'xy-99-aa', 6)).toEqual({ nextCode: 'XY99AA', nextIndex: 5 });

    // 5. Paste from middle slot
    expect(applyOtpInput('AB', 2, '99', 6)).toEqual({ nextCode: 'AB99', nextIndex: 4 });
  });

  it('persists and retrieves recent room code in localStorage', () => {
    setRecentRoom('KJ92MN', 'Alice');
    const recent = getRecentRoom();
    expect(recent?.code).toBe('KJ92MN');
    expect(recent?.name).toBe('Alice');

    // Rejects invalid room codes
    setRecentRoom('INVALID', 'Bob');
    const still = getRecentRoom();
    expect(still?.code).toBe('KJ92MN');
  });
});
