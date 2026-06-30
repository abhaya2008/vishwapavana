/**
 * Sanskritam.world Website Scraper
 * Scrapes the full Next.js website including all pages and assets
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://www.sanskritam.world';
const OUTPUT_DIR = path.join(__dirname, 'output');
const VISITED_URLS = new Set();
const ASSETS_TO_DOWNLOAD = new Set();
const MAX_DEPTH = 10;

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to make HTTP/HTTPS requests
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = new URL(redirectUrl, url).href;
                }
                return fetchUrl(redirectUrl).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Convert URL to local file path
function urlToFilePath(url) {
    try {
        const urlObj = new URL(url);
        let filePath = urlObj.pathname;

        // Handle root path
        if (filePath === '/' || filePath === '') {
            filePath = '/index.html';
        }

        // Add .html extension if needed
        if (!path.extname(filePath) && !filePath.endsWith('/')) {
            filePath += '.html';
        }

        // Handle directory paths
        if (filePath.endsWith('/')) {
            filePath += 'index.html';
        }

        return path.join(OUTPUT_DIR, filePath);
    } catch (e) {
        console.error('Invalid URL:', url);
        return null;
    }
}

// Save content to file
async function saveFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`Saved: ${filePath}`);
}

// Extract links from HTML
function extractLinks(html, baseUrl) {
    const links = new Set();

    // Extract href links
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            if (url.startsWith(BASE_URL)) {
                links.add(url);
            }
        } catch (e) { }
    }

    // Extract src links
    const srcRegex = /src=["']([^"']+)["']/gi;
    while ((match = srcRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            ASSETS_TO_DOWNLOAD.add(url);
        } catch (e) { }
    }

    // Extract Next.js data URLs
    const nextDataRegex = /_next\/[^"'\s]+/gi;
    while ((match = nextDataRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[0], baseUrl).href;
            ASSETS_TO_DOWNLOAD.add(url);
        } catch (e) { }
    }

    // Extract CSS URLs
    const cssUrlRegex = /url\(["']?([^"')]+)["']?\)/gi;
    while ((match = cssUrlRegex.exec(html)) !== null) {
        try {
            const url = new URL(match[1], baseUrl).href;
            ASSETS_TO_DOWNLOAD.add(url);
        } catch (e) { }
    }

    return links;
}

// Scrape a single page
async function scrapePage(url, depth = 0) {
    if (depth > MAX_DEPTH) return;
    if (VISITED_URLS.has(url)) return;

    // Skip external URLs
    if (!url.startsWith(BASE_URL)) return;

    // Skip certain file types
    const skipExtensions = ['.pdf', '.mp3', '.mp4', '.zip', '.rar'];
    if (skipExtensions.some(ext => url.toLowerCase().includes(ext))) {
        ASSETS_TO_DOWNLOAD.add(url);
        return;
    }

    VISITED_URLS.add(url);
    console.log(`Scraping [${depth}]: ${url}`);

    try {
        const content = await fetchUrl(url);
        const html = content.toString('utf8');

        // Save the page
        const filePath = urlToFilePath(url);
        if (filePath) {
            await saveFile(filePath, content);
        }

        // Extract and follow links
        const links = extractLinks(html, url);

        // Process links in sequence to avoid overwhelming the server
        for (const link of links) {
            await scrapePage(link, depth + 1);
            // Small delay to be nice to the server
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
    }
}

// Download assets
async function downloadAssets() {
    console.log(`\nDownloading ${ASSETS_TO_DOWNLOAD.size} assets...`);

    for (const url of ASSETS_TO_DOWNLOAD) {
        if (VISITED_URLS.has(url)) continue;
        VISITED_URLS.add(url);

        try {
            const content = await fetchUrl(url);
            const filePath = urlToFilePath(url);
            if (filePath) {
                await saveFile(filePath, content);
            }
            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            console.error(`Error downloading ${url}:`, error.message);
        }
    }
}

// Main scraper function
async function scrape() {
    console.log('Starting Sanskritam.world scrape...\n');
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    // Start with homepage
    await scrapePage(BASE_URL);

    // Download all collected assets
    await downloadAssets();

    console.log('\n=== Scrape Complete ===');
    console.log(`Pages scraped: ${VISITED_URLS.size}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

// Run scraper
scrape().catch(console.error);
