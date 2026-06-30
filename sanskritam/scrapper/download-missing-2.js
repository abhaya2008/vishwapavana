/**
 * Download additional missing Next.js chunks
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://www.sanskritam.world';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Missing chunks identified from server 404 logs
const MISSING_FILES = [
    '/_next/static/chunks/5446.9177f96d574c0022.js',
    '/_next/static/chunks/6285-62211c92fa872c5e.js',
    '/_next/static/chunks/1556-ab1a0072be60957a.js',
    '/_next/static/chunks/cb355538-4cc7974db596a29d.js',
    '/_next/static/chunks/646e0218-97108e1b30989192.js',
    '/_next/static/chunks/50-da8d19caf731c194.js',
    '/_next/static/chunks/pages/vyakaranam-de4eacdaeeaccd37.js',
    '/favicon.ico',
];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = new URL(redirectUrl, url).href;
                }
                return fetchUrl(redirectUrl).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function downloadFile(filePath) {
    const url = BASE_URL + filePath;
    const localPath = path.join(OUTPUT_DIR, filePath);
    const dir = path.dirname(localPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        console.log(`Downloading: ${filePath}`);
        const content = await fetchUrl(url);
        fs.writeFileSync(localPath, content);
        console.log(`  ✓ Saved`);
        return true;
    } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('Downloading additional missing chunks...\n');

    let success = 0;
    let failed = 0;

    for (const file of MISSING_FILES) {
        const result = await downloadFile(file);
        if (result) success++;
        else failed++;
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\nComplete! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
