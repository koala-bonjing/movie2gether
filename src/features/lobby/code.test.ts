import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  isValidRoomCode,
  sanitizeRoomCode,
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
});
