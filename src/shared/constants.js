const USPTO_BASE_URL = 'https://data.uspto.gov/apis/bulk-data';

module.exports = {
  USPTO_BASE_URL,
  USPTO_ENDPOINTS: {
    SEARCH: `${USPTO_BASE_URL}/search`,
    PRODUCT: `${USPTO_BASE_URL}/product`,
    DOWNLOAD: `${USPTO_BASE_URL}/download`,
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
