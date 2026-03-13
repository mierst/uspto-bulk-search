const constants = require('../src/shared/constants');

describe('constants', () => {
  it('has required URL constants', () => {
    expect(constants.TMSEARCH_URL).toBeDefined();
    expect(constants.TMSEARCH_URL).toContain('https://');
    expect(constants.TMSEARCH_PAGE).toBeDefined();
    expect(constants.TSDR_BASE_URL).toBeDefined();
  });

  it('has rate limits with positive values', () => {
    expect(constants.RATE_LIMITS).toBeDefined();
    expect(constants.RATE_LIMITS.GENERAL_PER_MINUTE).toBeGreaterThan(0);
    expect(constants.RATE_LIMITS.DOWNLOAD_PER_MINUTE).toBeGreaterThan(0);
  });

  it('has database filename', () => {
    expect(constants.DB_FILENAME).toBeDefined();
    expect(typeof constants.DB_FILENAME).toBe('string');
  });

  it('has folder names', () => {
    expect(constants.FOLDERS).toBeDefined();
    expect(constants.FOLDERS.ASSIGNMENTS).toBeDefined();
    expect(constants.FOLDERS.DOWNLOADS).toBeDefined();
    expect(constants.FOLDERS.EXPORTS).toBeDefined();
  });

  it('has file types', () => {
    expect(constants.FILE_TYPES).toBeDefined();
    expect(Array.isArray(constants.FILE_TYPES)).toBe(true);
    expect(constants.FILE_TYPES.length).toBeGreaterThan(0);
  });
});
