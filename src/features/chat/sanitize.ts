export type MessageToken =
  | { type: 'text'; value: string }
  | { type: 'link'; href: string; text: string };

const URL_REGEX = /(https?:\/\/[^\s<>"'`]+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[.,?!:;]+$/;

/**
 * Parses message string into safe text and link tokens.
 * Only http:// and https:// URLs are linkified.
 * Everything else remains strictly plain text.
 */
export function parseSafeTokens(text: string): MessageToken[] {
  if (!text) return [];

  const tokens: MessageToken[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(URL_REGEX));

  for (const match of matches) {
    const rawUrl = match[0];
    const startIndex = match.index!;

    // Any text prior to this match
    if (startIndex > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, startIndex),
      });
    }

    // Handle trailing punctuation like 'https://example.com/test.' -> link + '.'
    let cleanUrl = rawUrl;
    let trailingPunctuation = '';
    const punctMatch = rawUrl.match(TRAILING_PUNCTUATION_REGEX);
    if (punctMatch) {
      trailingPunctuation = punctMatch[0];
      cleanUrl = rawUrl.slice(0, -trailingPunctuation.length);
    }

    let isValid = false;
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        isValid = true;
      }
    } catch {
      isValid = false;
    }

    if (isValid) {
      tokens.push({
        type: 'link',
        href: cleanUrl,
        text: cleanUrl,
      });
      if (trailingPunctuation) {
        tokens.push({
          type: 'text',
          value: trailingPunctuation,
        });
      }
    } else {
      const prev = tokens[tokens.length - 1];
      if (prev && prev.type === 'text') {
        prev.value += rawUrl;
      } else {
        tokens.push({
          type: 'text',
          value: rawUrl,
        });
      }
    }

    lastIndex = startIndex + rawUrl.length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    const prev = tokens[tokens.length - 1];
    if (prev && prev.type === 'text') {
      prev.value += remaining;
    } else {
      tokens.push({
        type: 'text',
        value: remaining,
      });
    }
  }

  return tokens;
}

/**
 * Truncates and cleans input text to max 2000 characters.
 */
export function sanitizeInputText(input: string): string {
  return input.trim().slice(0, 2000);
}
