/**
 * Download missing Next.js assets
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://www.sanskritam.world';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Missing files from the error logs
const MISSING_FILES = [
    '/_next/static/css/b96670bdeb5591be.css',
    '/_next/static/css/82f194c5b3d68307.css',
    '/_next/static/chunks/webpack-1c34414c6dfc1a39.js',
    '/_next/static/chunks/framework-a71af9b1c76f668e.js',
    '/_next/static/chunks/main-f4356971d9eccb4d.js',
    '/_next/static/chunks/pages/_app-af595b29cea5a040.js',
    '/_next/static/chunks/e21e5bbe-a101e90b11e2ae7e.js',
    '/_next/static/chunks/69480c19-580437bf37083c2d.js',
    '/_next/static/chunks/257e8032-d9283d777d451ddc.js',
    '/_next/static/chunks/1664-468559f2e2a9395f.js',
    '/_next/static/chunks/7066-1edf88d71cc6b4cd.js',
    '/_next/static/chunks/5675-f37c0019ec59202f.js',
    '/_next/static/chunks/605-98f64d8ae2693601.js',
    '/_next/static/chunks/2169-305e334b30277ec5.js',
    '/_next/static/chunks/2126-5869f4fd989ca617.js',
    '/_next/static/chunks/4909-a4725392a832ce47.js',
    '/_next/static/chunks/4157-06b79b6f8294f511.js',
    '/_next/static/chunks/pages/index-dac18e92b5aafdd1.js',
    '/_next/static/kXfpIMGRw19K5ZCQ3KiT3/_buildManifest.js',
    '/_next/static/kXfpIMGRw19K5ZCQ3KiT3/_ssgManifest.js',
    '/_next/static/media/f58de321e9854cd3-s.p.woff2',
    '/_next/static/media/ca60b95d975a0530-s.p.woff2',
    '/_next/static/media/d4ddfe47cde446a0-s.p.woff2',
    '/_next/static/media/c1b11e140b58cf5a-s.p.woff2',
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
    console.log('Downloading missing Next.js assets...\n');

    let success = 0;
    let failed = 0;

    for (const file of MISSING_FILES) {
        const result = await downloadFile(file);
        if (result) success++;
        else failed++;

        // Small delay
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\nComplete! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
