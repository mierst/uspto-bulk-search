/**
 * Local test script for USPTO Puppeteer session + search.
 * Run: node test-session.js
 */
const puppeteer = require('puppeteer');

const { TMSEARCH_URL, TMSEARCH_PAGE } = require('./packages/core/src/constants');

async function test() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log('Navigating to', TMSEARCH_PAGE);
  await page.goto(TMSEARCH_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

  // Poll for cookies
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const cookies = await page.cookies();
    console.log(`Wait ${(i + 1) * 2}s — ${cookies.length} cookies: ${cookies.map(c => c.name).join(', ')}`);
    if (cookies.length >= 2) break;
  }

  const cookies = await page.cookies();
  console.log('\nFinal cookies:', cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`));

  // Try a search via in-browser fetch
  console.log('\nTesting search for "batman" via in-browser fetch...');
  const body = {
    query: {
      bool: {
        must: [{
          bool: {
            should: [
              { match_phrase: { WM: { query: 'batman', boost: 5 } } },
              { match: { WM: { query: 'batman', boost: 2 } } },
            ],
          },
        }],
      },
    },
    size: 5,
    from: 0,
    track_total_hits: true,
    _source: ['wordmark', 'ownerName', 'alive', 'id'],
  };

  const result = await page.evaluate(async (url, reqBody) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const text = await res.text();
      return { status: res.status, ok: res.ok, body: text };
    } catch (e) {
      return { error: e.message };
    }
  }, TMSEARCH_URL, body);

  console.log('Search result status:', result.status, result.ok ? 'OK' : 'FAILED');
  if (result.ok) {
    try {
      const data = JSON.parse(result.body);
      console.log('Total hits:', data.hits?.totalValue || data.hits?.total?.value);
      const hits = data.hits?.hits || [];
      for (const hit of hits.slice(0, 3)) {
        const src = hit._source || hit.source || {};
        console.log(`  - ${src.wordmark} (${src.ownerName}) [${src.alive ? 'LIVE' : 'DEAD'}]`);
      }
      console.log('\n*** IN-BROWSER FETCH WORKS! ***');
    } catch (e) {
      console.log('JSON parse error:', e.message);
      console.log('Raw response length:', result.body.length);
    }
  } else {
    console.log('Response:', result.body?.substring(0, 300) || result.error);
  }

  // Also test Node fetch with cookies for comparison
  console.log('\nTesting search via Node fetch with cookies...');
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  try {
    const nodeRes = await fetch(TMSEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: cookieString,
        Origin: 'https://tmsearch.uspto.gov',
        Referer: TMSEARCH_PAGE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    });
    console.log('Node fetch status:', nodeRes.status, nodeRes.ok ? 'OK' : 'FAILED');
    if (!nodeRes.ok) {
      const text = await nodeRes.text();
      console.log('Response:', text.substring(0, 300));
    }
  } catch (e) {
    console.log('Node fetch error:', e.message);
  }

  await browser.close();
  console.log('\nDone.');
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
