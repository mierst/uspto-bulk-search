// Mock electron modules that uspto-client.js imports at top level
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  session: {},
}));

const { normalizeSearchResults } = require('../src/main/services/uspto-client');

describe('normalizeSearchResults', () => {
  it('maps _source fields from Elasticsearch response', () => {
    const data = {
      hits: {
        totalValue: 2,
        hits: [
          {
            _source: {
              id: '87654321',
              registrationId: '1234567',
              wordmark: 'ACME',
              alive: true,
              ownerName: 'Acme Corp',
              ownerType: 'Corporation',
              attorney: 'Jane Smith',
              filedDate: '2024-01-15',
              registrationDate: '2024-06-01',
              abandonDate: null,
              cancelDate: null,
              markType: ['TRADEMARK'],
              markDescription: ['The mark consists of standard characters'],
              goodsAndServices: ['Software products'],
              internationalClass: ['IC 009'],
              drawingCode: '4000',
              disclaimer: null,
            },
          },
          {
            _source: {
              id: '99999999',
              wordmarkPseudoText: 'PSEUDO MARK',
              alive: false,
            },
          },
        ],
      },
    };

    const result = normalizeSearchResults(data);

    expect(result.numFound).toBe(2);
    expect(result.items).toHaveLength(2);

    const first = result.items[0];
    expect(first.serialNumber).toBe('87654321');
    expect(first.registrationNumber).toBe('1234567');
    expect(first.markText).toBe('ACME');
    expect(first.status).toBe('LIVE');
    expect(first.alive).toBe(true);
    expect(first.ownerName).toBe('Acme Corp');
    expect(first.attorney).toBe('Jane Smith');
    expect(first.filedDate).toBe('2024-01-15');

    const second = result.items[1];
    expect(second.serialNumber).toBe('99999999');
    expect(second.markText).toBe('PSEUDO MARK');
    expect(second.status).toBe('DEAD');
    expect(second.alive).toBe(false);
  });

  it('handles source (without underscore) field name', () => {
    const data = {
      hits: {
        totalValue: 1,
        hits: [
          {
            source: {
              id: '11111111',
              wordmark: 'SOURCE TEST',
              alive: true,
            },
          },
        ],
      },
    };

    const result = normalizeSearchResults(data);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].serialNumber).toBe('11111111');
    expect(result.items[0].markText).toBe('SOURCE TEST');
  });

  it('returns empty results for empty hits', () => {
    const data = { hits: { totalValue: 0, hits: [] } };

    const result = normalizeSearchResults(data);

    expect(result.numFound).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('handles missing hits object gracefully', () => {
    const result = normalizeSearchResults({});

    expect(result.numFound).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('uses total.value when totalValue is missing', () => {
    const data = {
      hits: {
        total: { value: 42 },
        hits: [{ _source: { id: '100', wordmark: 'TEST', alive: true } }],
      },
    };

    const result = normalizeSearchResults(data);

    expect(result.numFound).toBe(42);
  });

  it('defaults null for missing optional fields', () => {
    const data = {
      hits: {
        totalValue: 1,
        hits: [{ _source: { alive: true } }],
      },
    };

    const result = normalizeSearchResults(data);
    const item = result.items[0];

    expect(item.serialNumber).toBeNull();
    expect(item.registrationNumber).toBeNull();
    expect(item.markText).toBeNull();
    expect(item.ownerName).toBeNull();
    expect(item.attorney).toBeNull();
    expect(item.filedDate).toBeNull();
    expect(item.markType).toBeNull();
    expect(item.goodsAndServices).toBeNull();
  });
});
