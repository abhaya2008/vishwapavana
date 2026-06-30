/**
 * Comprehensive Sanskritam.world Website Scraper
 * Downloads ALL pages and assets including deep sub-pages
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://www.sanskritam.world';
const OUTPUT_DIR = path.join(__dirname, 'output');
const VISITED_URLS = new Set();
const PENDING_ASSETS = new Set();
const MAX_DEPTH = 15;

// Known sections to scrape
const KNOWN_SECTIONS = [
    '/',
    '/vyakaranam',
    '/vyakaranam/sutraani',
    '/vyakaranam/sutraani/1',
    '/vyakaranam/sutraani/2',
    '/vyakaranam/sutraani/3',
    '/vyakaranam/sutraani/4',
    '/vyakaranam/sutraani/5',
    '/vyakaranam/sutraani/6',
    '/vyakaranam/sutraani/7',
    '/vyakaranam/sutraani/8',
    '/vyakaranam/dhatupaath',
    '/vyakaranam/lingaanushasanam',
    '/vyakaranam/unaadi',
    '/vyakaranam/ganapatha',
    '/vyakaranam/paribhashapaath',
    '/shikshapatri',
    '/shikshapatri/sa',
    '/vedas',
    '/brahmasutra',
    '/satsangi_jeevan',
    '/satsangi_jeevan/sa',
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function fetchUrl(url, retries = 3) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = new URL(redirectUrl, url).href;
                }
                return fetchUrl(redirectUrl, retries).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                if (retries > 0) {
                    setTimeout(() => {
                        fetchUrl(url, retries - 1).then(resolve).catch(reject);
                    }, 500);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', (err) => {
            if (retries > 0) {
                setTimeout(() => {
                    fetchUrl(url, retries - 1).then(resolve).catch(reject);
                }, 500);
            } else {
                reject(err);
            }
        });
    });
}

function urlToFilePath(url) {
    try {
        const urlObj = new URL(url);
        let filePath = urlObj.pathname;

        if (filePath === '/' || filePath === '') {
            filePath = '/index.html';
        }

        // Don't add .html to files that already have extensions
        const ext = path.extname(filePath);
        if (!ext && !filePath.endsWith('/')) {
            filePath += '.html';
        }

        if (filePath.endsWith('/')) {
            filePath += 'index.html';
        }

        return path.join(OUTPUT_DIR, filePath);
    } catch (e) {
        return null;
    }
}

async function saveFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
}

function extractAllUrls(html, baseUrl) {
    const urls = new Set();

    // Extract href links (pages)
    const hrefRegex = /href=["']([^"'#]+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
        try {
            let href = match[1];
            if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

            const url = new URL(href, baseUrl).href;
            if (url.startsWith(BASE_URL) && !url.includes('#')) {
                urls.add(url.split('?')[0]); // Remove query params
            }
        } catch (e) { }
    }

    // Extract src links (assets)
    const srcRegex = /src=["']([^"']+)["']/gi;
    while ((match = srcRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            if (url.startsWith(BASE_URL) || url.includes('/_next/')) {
                PENDING_ASSETS.add(url);
            }
        } catch (e) { }
    }

    // Extract Next.js chunks from inline scripts
    const chunkRegex = /"([^"]*\/_next\/static\/chunks\/[^"]+\.js)"/gi;
    while ((match = chunkRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            PENDING_ASSETS.add(url);
        } catch (e) { }
    }

    // Extract all _next paths
    const nextRegex = /["'](\/_next\/[^"'\s]+)["']/gi;
    while ((match = nextRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            PENDING_ASSETS.add(url);
        } catch (e) { }
    }

    // Extract static assets
    const staticRegex = /["'](\/static\/[^"'\s]+)["']/gi;
    while ((match = staticRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            PENDING_ASSETS.add(url);
        } catch (e) { }
    }

    return urls;
}

async function scrapePage(url, depth = 0) {
    if (depth > MAX_DEPTH) return new Set();
    if (VISITED_URLS.has(url)) return new Set();

    // Skip non-page URLs
    const skipExtensions = ['.pdf', '.mp3', '.mp4', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.ico', '.js', '.css'];
    if (skipExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
        PENDING_ASSETS.add(url);
        return new Set();
    }

    VISITED_URLS.add(url);
    console.log(`[${depth}] Scraping: ${url}`);

    try {
        const content = await fetchUrl(url);
        const html = content.toString('utf8');

        const filePath = urlToFilePath(url);
        if (filePath) {
            await saveFile(filePath, content);
            console.log(`    ✓ Saved: ${path.relative(OUTPUT_DIR, filePath)}`);
        }

        return extractAllUrls(html, url);
    } catch (error) {
        console.log(`    ✗ Error: ${error.message}`);
        return new Set();
    }
}

async function downloadAsset(url) {
    if (VISITED_URLS.has(url)) return;
    VISITED_URLS.add(url);

    try {
        const content = await fetchUrl(url);
        const filePath = urlToFilePath(url);
        if (filePath) {
            await saveFile(filePath, content);
            console.log(`  ✓ Asset: ${path.relative(OUTPUT_DIR, filePath)}`);
        }
    } catch (error) {
        console.log(`  ✗ Asset failed: ${url.replace(BASE_URL, '')} - ${error.message}`);
    }
}

async function scrapeRecursive(startUrls) {
    let urlsToProcess = new Set(startUrls);

    while (urlsToProcess.size > 0) {
        const currentBatch = Array.from(urlsToProcess);
        urlsToProcess = new Set();

        for (const url of currentBatch) {
            const newUrls = await scrapePage(url);
            for (const newUrl of newUrls) {
                if (!VISITED_URLS.has(newUrl)) {
                    urlsToProcess.add(newUrl);
                }
            }
            await new Promise(r => setTimeout(r, 150)); // Be nice to server
        }
    }
}

async function main() {
    console.log('================================================');
    console.log('  Comprehensive Sanskritam.world Scraper');
    console.log('================================================\n');
    console.log(`Output: ${OUTPUT_DIR}\n`);

    // Scrape known sections first
    console.log('Phase 1: Scraping known sections...\n');
    const knownUrls = KNOWN_SECTIONS.map(p => BASE_URL + p);
    await scrapeRecursive(knownUrls);

    // Also follow any discovered links
    console.log('\nPhase 2: Following discovered links...\n');
    await scrapeRecursive(Array.from(PENDING_ASSETS).filter(u =>
        u.startsWith(BASE_URL) &&
        !u.includes('/_next/') &&
        !u.includes('/static/')
    ));

    // Download all collected assets
    console.log('\nPhase 3: Downloading assets...\n');
    const assets = Array.from(PENDING_ASSETS);
    console.log(`Found ${assets.length} assets to download\n`);

    for (const url of assets) {
        await downloadAsset(url);
        await new Promise(r => setTimeout(r, 50));
    }

    console.log('\n================================================');
    console.log('  Scrape Complete!');
    console.log('================================================');
    console.log(`Pages scraped: ${VISITED_URLS.size}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('\nTo view: node server.js');
}

main().catch(console.error);
