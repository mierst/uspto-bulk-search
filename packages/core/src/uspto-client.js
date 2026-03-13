let BrowserWindow, session;
try {
  const electron = require('electron');
  BrowserWindow = electron.BrowserWindow;
  session = electron.session;
} catch (e) {
  // Electron not available (e.g., running in web context)
  BrowserWindow = null;
  session = null;
}

let puppeteer;
try {
  puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
} catch (e) {
  try {
    puppeteer = require('puppeteer');
  } catch (e2) {
    puppeteer = null;
  }
}

const Bottleneck = require('bottleneck');
const { TMSEARCH_URL, TMSEARCH_PAGE, TSDR_BASE_URL, RATE_LIMITS } = require('./constants');

// Rate limiter for general API calls
const generalLimiter = new Bottleneck({
  reservoir: RATE_LIMITS.GENERAL_PER_MINUTE,
  reservoirRefreshAmount: RATE_LIMITS.GENERAL_PER_MINUTE,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 2,
  minTime: 1000,
});

// Rate limiter for downloads
const downloadLimiter = new Bottleneck({
  reservoir: RATE_LIMITS.DOWNLOAD_PER_MINUTE,
  reservoirRefreshAmount: RATE_LIMITS.DOWNLOAD_PER_MINUTE,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 15000,
});

let apiKey = null;

// Electron session state
let searchWindow = null;
let sessionReady = false;

// Puppeteer session state
let puppeteerBrowser = null;
let puppeteerPage = null;
let puppeteerCookies = null;

const isElectron = typeof BrowserWindow === 'function';

function setApiKey(key) {
  apiKey = key;
}

/**
 * Initialize session — uses Electron BrowserWindow or Puppeteer depending on environment.
 */
async function initSession() {
  if (isElectron) {
    return initElectronSession();
  } else {
    return initPuppeteerSession();
  }
}

/**
 * Electron: hidden BrowserWindow to solve WAF and get session cookies.
 */
async function initElectronSession() {
  if (searchWindow && !searchWindow.isDestroyed()) {
    return;
  }

  searchWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  searchWindow.on('closed', () => {
    searchWindow = null;
    sessionReady = false;
  });

  try {
    await searchWindow.loadURL(TMSEARCH_PAGE);
    await new Promise(resolve => setTimeout(resolve, 4000));
    sessionReady = true;
    console.log('[USPTO] Electron search session initialized');
  } catch (err) {
    console.error('[USPTO] Failed to init session:', err.message);
    throw new Error('Could not connect to USPTO. Check your internet connection.');
  }
}

/**
 * Puppeteer: headless browser to solve WAF and extract cookies for fetch requests.
 */
async function initPuppeteerSession() {
  if (puppeteerCookies && sessionReady) {
    return;
  }

  if (!puppeteer) {
    throw new Error('Puppeteer is not installed. Cannot initialize USPTO session.');
  }

  console.log('[USPTO] Initializing Puppeteer session...');

  if (!puppeteerBrowser) {
    puppeteerBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });
  }

  try {
    puppeteerPage = await puppeteerBrowser.newPage();
    await puppeteerPage.setViewport({ width: 1920, height: 1080 });
    await puppeteerPage.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Remove webdriver flag
    await puppeteerPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await puppeteerPage.goto(TMSEARCH_PAGE, { waitUntil: 'networkidle0', timeout: 60000 });
    // Wait for WAF challenge to fully resolve
    await new Promise(resolve => setTimeout(resolve, 8000));

    puppeteerCookies = await puppeteerPage.cookies();
    sessionReady = true;
    console.log('[USPTO] Puppeteer session initialized, got', puppeteerCookies.length, 'cookies');

    // Close the page to free memory, keep browser alive
    await puppeteerPage.close();
    puppeteerPage = null;
  } catch (err) {
    console.error('[USPTO] Puppeteer session failed:', err.message);
    if (puppeteerPage) { await puppeteerPage.close().catch(() => {}); puppeteerPage = null; }
    throw new Error('Could not connect to USPTO. Check your internet connection.');
  }

  // Auto-refresh cookies every 25 minutes
  setTimeout(() => {
    sessionReady = false;
    puppeteerCookies = null;
    console.log('[USPTO] Session cookies expired, will refresh on next request');
  }, 25 * 60 * 1000);
}

/**
 * Ensure the session is ready before making API calls.
 */
async function ensureSession() {
  if (isElectron) {
    if (!sessionReady || !searchWindow || searchWindow.isDestroyed()) {
      await initSession();
    }
  } else {
    if (!sessionReady || !puppeteerCookies) {
      await initSession();
    }
  }
}

/**
 * Make a fetch request with session cookies.
 * Electron: uses session.fetch(). Node.js: uses global fetch with cookie header.
 */
async function sessionFetch(url, options = {}) {
  await ensureSession();

  if (isElectron) {
    const ses = searchWindow.webContents.session;
    return ses.fetch(url, options);
  } else {
    // Build cookie header from Puppeteer cookies
    const cookieString = puppeteerCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    const headers = { ...(options.headers || {}), Cookie: cookieString };
    const response = await fetch(url, { ...options, headers });
    return response;
  }
}

/**
 * Search trademarks by mark text using the tmsearch Elasticsearch API.
 */
async function search(query, options = {}) {
  return generalLimiter.schedule(async () => {
    const size = options.rows || 50;
    const from = options.start || 0;

    // Build filter clauses from options
    const filters = [];
    if (options.alive !== undefined) {
      filters.push({ term: { alive: options.alive } });
    }
    if (options.markType) {
      filters.push({ match_phrase: { markType: options.markType } });
    }
    if (options.internationalClass) {
      filters.push({ match_phrase: { internationalClass: options.internationalClass } });
    }
    if (options.ownerName) {
      filters.push({ match: { ownerName: options.ownerName } });
    }
    if (options.filedAfter || options.filedBefore) {
      const range = {};
      if (options.filedAfter) range.gte = options.filedAfter;
      if (options.filedBefore) range.lte = options.filedBefore;
      filters.push({ range: { filedDate: range } });
    }

    // Build Elasticsearch query matching what tmsearch.uspto.gov uses
    const boolQuery = {
      must: [
        {
          bool: {
            should: [
              { match_phrase: { WM: { query, boost: 5 } } },
              { match: { WM: { query, boost: 2 } } },
              { match_phrase: { PM: { query, boost: 2 } } },
            ],
          },
        },
      ],
    };
    if (filters.length > 0) {
      boolQuery.filter = filters;
    }

    const body = {
      query: { bool: boolQuery },
      size,
      from,
      track_total_hits: true,
      _source: [
        'alive', 'attorney', 'filedDate', 'goodsAndServices', 'id',
        'internationalClass', 'markDescription', 'markType', 'ownerName',
        'ownerType', 'registrationDate', 'registrationId', 'registrationType',
        'wordmark', 'wordmarkPseudoText', 'abandonDate', 'cancelDate',
        'disclaimer', 'drawingCode', 'usClass',
      ],
    };

    try {
      console.log('[USPTO] Searching for:', query);
      const response = await sessionFetch(TMSEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[USPTO] HTTP', response.status, text.substring(0, 300));

        if (response.status === 403 || response.status === 401) {
          // WAF or auth issue — reinit session and retry
          console.log('[USPTO] Reinitializing session...');
          sessionReady = false;
          await initSession();
          const retry = await sessionFetch(TMSEARCH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(body),
          });
          if (!retry.ok) {
            throw new Error(`USPTO search failed after retry: ${retry.status}`);
          }
          const retryData = await retry.json();
          return normalizeSearchResults(retryData);
        }
        throw new Error(`USPTO search failed: ${response.status}`);
      }

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error('Non-JSON response: ' + text.substring(0, 200)); }
      console.log('[USPTO] Hits:', data.hits?.totalValue ?? data.hits?.total?.value ?? 'none');
      return normalizeSearchResults(data);
    } catch (err) {
      console.error('[USPTO] Search error:', err.message);
      throw new Error(`USPTO search failed: ${err.message}`);
    }
  });
}

/**
 * Get case status from TSDR API by serial or registration number.
 * @param {string} caseId - e.g., "sn78787878" or "rn1234567"
 */
async function getCaseStatus(caseId) {
  return generalLimiter.schedule(async () => {
    const url = `${TSDR_BASE_URL}/ts/cd/casestatus/${caseId}/info`;
    const headers = { Accept: 'application/xml' };
    if (apiKey) headers['USPTO-API-Key'] = apiKey;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      throw new Error(`TSDR lookup failed: ${response.status} ${response.statusText}`);
    }
    return response.text();
  });
}

/**
 * Download a file from a given URL.
 */
async function downloadFile(url) {
  return downloadLimiter.schedule(async () => {
    const headers = {};
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(url, { headers, redirect: 'follow' });
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
 * Normalize Elasticsearch response from tmsearch into our app format.
 */
function normalizeSearchResults(data) {
  const items = [];
  const hits = data.hits?.hits || [];

  for (const hit of hits) {
    const src = hit.source || hit._source || {};
    items.push({
      serialNumber: src.id || null,
      registrationNumber: src.registrationId || null,
      markText: src.wordmark || src.wordmarkPseudoText || null,
      status: src.alive ? 'LIVE' : 'DEAD',
      alive: src.alive || false,
      ownerName: src.ownerName || null,
      ownerType: src.ownerType || null,
      attorney: src.attorney || null,
      filedDate: src.filedDate || null,
      registrationDate: src.registrationDate || null,
      abandonDate: src.abandonDate || null,
      cancelDate: src.cancelDate || null,
      markType: src.markType || null,
      markDescription: src.markDescription || null,
      goodsAndServices: src.goodsAndServices || null,
      internationalClass: src.internationalClass || null,
      drawingCode: src.drawingCode || null,
      disclaimer: src.disclaimer || null,
      raw: src,
    });
  }

  return {
    numFound: data.hits?.totalValue || data.hits?.total?.value || items.length,
    items,
  };
}

/**
 * Clean up the hidden browser window on app exit.
 */
async function destroy() {
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.destroy();
    searchWindow = null;
    sessionReady = false;
  }
  if (puppeteerBrowser) {
    await puppeteerBrowser.close().catch(() => {});
    puppeteerBrowser = null;
    puppeteerPage = null;
    puppeteerCookies = null;
    sessionReady = false;
  }
}

module.exports = {
  search,
  getCaseStatus,
  downloadFile,
  setApiKey,
  initSession,
  destroy,
  normalizeSearchResults,
};
