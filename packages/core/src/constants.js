module.exports = {
  // Trademark search (Elasticsearch-based, requires browser session for WAF)
  TMSEARCH_URL: 'https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch',
  TMSEARCH_PAGE: 'https://tmsearch.uspto.gov/search/search-information',

  // TSDR API (case status/documents by serial or registration number)
  TSDR_BASE_URL: 'https://tsdrapi.uspto.gov',

  // Bulk Datasets API (for downloading bulk data files)
  BULK_DATA_BASE_URL: 'https://api.uspto.gov/api/v1/datasets/products',
  BULK_DATA_ENDPOINTS: {
    SEARCH: 'https://api.uspto.gov/api/v1/datasets/products/search',
    PRODUCT: 'https://api.uspto.gov/api/v1/datasets/products',
    DOWNLOAD: 'https://api.uspto.gov/api/v1/datasets/products/files',
  },

  RATE_LIMITS: {
    GENERAL_PER_MINUTE: 60,
    DOWNLOAD_PER_MINUTE: 4,
  },
  FILE_TYPES: ['xml', 'json', 'pdf', 'zip'],
  PROJECT_META_FILE: '_project.json',
  DB_FILENAME: '.uspto-search.db',
  FOLDERS: {
    ASSIGNMENTS: 'assignments',
    DOWNLOADS: 'downloads',
    EXPORTS: 'exports',
  },
};
