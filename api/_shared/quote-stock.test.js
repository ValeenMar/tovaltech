import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { extractQuoteItems } = require('./quote-stock');

describe('quote stock helpers', () => {
  it('extracts valid quote items from object payload', () => {
    const items = extractQuoteItems({
      items: [
        { id: '10', quantity: '2' },
        { id: 'abc', quantity: 1 },
        { id: 12, quantity: 0 },
      ],
    });

    expect(items).toEqual([{ id: 10, quantity: 2 }]);
  });

  it('extracts from JSON string payload and ignores malformed input', () => {
    const fromJson = extractQuoteItems(JSON.stringify({
      items: [{ id: 5, quantity: 3 }],
    }));
    const malformed = extractQuoteItems('{invalid json');

    expect(fromJson).toEqual([{ id: 5, quantity: 3 }]);
    expect(malformed).toEqual([]);
  });
});
