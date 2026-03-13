const database = require('../database');

/**
 * Perform a local search across assignments and downloads
 * Uses SQL LIKE queries against the SQLite database
 */
async function search(dataRoot, query) {
  return database.localSearch(dataRoot, query);
}

module.exports = {
  search,
};
