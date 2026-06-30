const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.sanskritam.world';
const OUTPUT_DIR = './output';

// Missing files from console errors
const missingFiles = [
    // CSS
    '/_next/static/css/050de91dfcb80622.css',

    // JS chunks
    '/_next/static/chunks/1498.260778636a1ffd67.js',
    '/_next/static/chunks/pages/about-7df97b9537772a04.js',
    '/_next/static/chunks/3504.021c36293a31560c.js',

    // Images - static paths
    '/static/images/sardhar-logo.png',
    '/static/images/locationmap.png',
    '/static/images/social/fb.png',
    '/static/images/social/insta.png',
    '/static/images/social/teligrm.png',
    '/static/images/social/tw.png',
    '/static/images/social/yt.png',
    '/static/images/stack_pages.webp',
    '/static/images/Asset-1.svg',
    '/static/images/line.png',

    // API endpoints - try to download as JSON
    '/api/shikshapatri',
];

async function downloadFile(urlPath) {
    const url = `${BASE_URL}${urlPath}`;
    let outputPath = path.join(OUTPUT_DIR, urlPath);

    // Create directory
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        }, (response) => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(outputPath);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`  ✓ Downloaded: ${urlPath}`);
                    resolve(true);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // Follow redirect
                const redirectUrl = response.headers.location;
                console.log(`  → Redirected: ${urlPath} -> ${redirectUrl}`);
                resolve(false);
            } else {
                console.log(`  ✗ Failed (${response.statusCode}): ${urlPath}`);
                resolve(false);
            }
        }).on('error', (err) => {
            console.log(`  ✗ Error: ${urlPath} - ${err.message}`);
            resolve(false);
        });
    });
}

async function main() {
    console.log('='.repeat(50));
    console.log('  Downloading Missing Assets');
    console.log('='.repeat(50));
    console.log('\n');

    for (const file of missingFiles) {
        await downloadFile(file);
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n');
    console.log('='.repeat(50));
    console.log('  Download Complete!');
    console.log('='.repeat(50));
}

main();
