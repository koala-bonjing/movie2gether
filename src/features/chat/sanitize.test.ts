import { describe, it, expect } from 'vitest';
import { parseSafeTokens, sanitizeInputText } from './sanitize';

describe('chat sanitization & linkification', () => {
  it('returns empty array for empty or blank text', () => {
    expect(parseSafeTokens('')).toEqual([]);
  });

  it('preserves plain text without modifying it', () => {
    const tokens = parseSafeTokens('Hello, how is the movie?');
    expect(tokens).toEqual([{ type: 'text', value: 'Hello, how is the movie?' }]);
  });

  it('linkifies valid https and http URLs', () => {
    const tokens = parseSafeTokens('Watch this: https://example.com/video and http://duet.app');
    expect(tokens).toEqual([
      { type: 'text', value: 'Watch this: ' },
      { type: 'link', href: 'https://example.com/video', text: 'https://example.com/video' },
      { type: 'text', value: ' and ' },
      { type: 'link', href: 'http://duet.app', text: 'http://duet.app' },
    ]);
  });

  it('strips trailing punctuation from URLs in sentences', () => {
    const tokens = parseSafeTokens('Did you see https://example.com/test? It was cool!');
    expect(tokens).toEqual([
      { type: 'text', value: 'Did you see ' },
      { type: 'link', href: 'https://example.com/test', text: 'https://example.com/test' },
      { type: 'text', value: '? It was cool!' },
    ]);
  });

  it('does NOT linkify unsafe protocols like javascript: or data:', () => {
    const unsafeText = 'javascript:alert(1) and data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
    const tokens = parseSafeTokens(unsafeText);
    expect(tokens).toEqual([{ type: 'text', value: unsafeText }]);
  });

  it('does NOT linkify HTML tags or XSS injection vectors', () => {
    const xss = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const tokens = parseSafeTokens(xss);
    expect(tokens).toEqual([{ type: 'text', value: xss }]);
  });

  it('properly sanitizes input text length and trims whitespace', () => {
    expect(sanitizeInputText('   hello world   ')).toBe('hello world');
    const longString = 'a'.repeat(3000);
    expect(sanitizeInputText(longString).length).toBe(2000);
  });
});
