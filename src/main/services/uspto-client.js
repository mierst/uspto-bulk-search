const Bottleneck = require('bottleneck');
const { USPTO_ENDPOINTS, RATE_LIMITS } = require('../../shared/constants');

// General rate limiter: 60 requests per minute
const generalLimiter = new Bottleneck({
  reservoir: RATE_LIMITS.GENERAL_PER_MINUTE,
  reservoirRefreshAmount: RATE_LIMITS.GENERAL_PER_MINUTE,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 2,
  minTime: 1000, // At least 1 second between requests
});

// Download rate limiter: 4 per minute
const downloadLimiter = new Bottleneck({
  reservoir: RATE_LIMITS.DOWNLOAD_PER_MINUTE,
  reservoirRefreshAmount: RATE_LIMITS.DOWNLOAD_PER_MINUTE,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 15000, // At least 15 seconds between downloads
});

let apiKey = null;

function setApiKey(key) {
  apiKey = key;
}

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

/**
 * Search USPTO bulk data for trademark records
 */
async function search(query, options = {}) {
  return generalLimiter.schedule(async () => {
    const body = {
      productTitle: options.productTitle || 'Trademark',
      query: query,
      start: options.start || 0,
      rows: options.rows || 25,
    };

    const response = await fetch(USPTO_ENDPOINTS.SEARCH, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`USPTO search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeSearchResults(data);
  });
}

/**
 * Get product details from USPTO
 */
async function getProduct(productId) {
  return generalLimiter.schedule(async () => {
    const url = `${USPTO_ENDPOINTS.PRODUCT}?productId=${encodeURIComponent(productId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`USPTO product lookup failed: ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Download a bulk data file from USPTO
 */
async function downloadFile(url) {
  return downloadLimiter.schedule(async () => {
    const response = await fetch(url, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Download rate limit exceeded. Please wait and try again.');
      }
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  });
}

/**
 * Normalize USPTO search response into consistent format
 */
function normalizeSearchResults(data) {
  // The actual response structure may vary; this normalizes it
  const items = [];
  const records = data.results || data.response?.docs || data.docs || [];

  for (const record of records) {
    items.push({
      serialNumber: record.serialNumber || record.serial_number || record.applicationNumberText || null,
      registrationNumber: record.registrationNumber || record.registration_number || null,
      markText: record.markText || record.mark_text || record.wordMark || record.productTitle || null,
      status: record.status || record.markCurrentStatusExternalDescriptionText || null,
      assignor: record.assignor || null,
      assignee: record.assignee || null,
      executionDate: record.executionDate || record.execution_date || null,
      recordedDate: record.recordedDate || record.recorded_date || null,
      reelFrame: record.reelFrame || record.reel_frame || null,
      assignmentCount: record.assignmentCount || null,
      raw: record,
    });
  }

  return {
    numFound: data.numFound || data.response?.numFound || items.length,
    items,
  };
}

module.exports = {
  search,
  getProduct,
  downloadFile,
  setApiKey,
};
