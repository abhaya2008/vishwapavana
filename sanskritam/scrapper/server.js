/**
 * Simple HTTP Server to serve the scraped website
 * Run with: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const OUTPUT_DIR = path.join(__dirname, 'output');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    let filePath = req.url;

    // Handle _next/image requests - redirect to original image
    if (filePath.startsWith('/_next/image')) {
        const urlParams = new URLSearchParams(filePath.split('?')[1]);
        const originalUrl = urlParams.get('url');
        if (originalUrl) {
            filePath = decodeURIComponent(originalUrl);
            console.log(`Image redirect: ${req.url} -> ${filePath}`);
        }
    }

    // Remove query strings
    filePath = filePath.split('?')[0];

    // Handle root path
    if (filePath === '/') {
        filePath = '/index.html';
    }

    // Construct full path
    let fullPath = path.join(OUTPUT_DIR, filePath);

    // Check if it's a directory - if so, look for .html file or index.html
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        // Try pagename.html first (e.g., /shikshapatri -> /shikshapatri.html)
        const htmlPath = fullPath + '.html';
        if (fs.existsSync(htmlPath)) {
            fullPath = htmlPath;
        } else {
            // Try index.html inside directory
            const indexPath = path.join(fullPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                fullPath = indexPath;
            }
        }
    }

    // If no extension and file doesn't exist, try adding .html
    if (!path.extname(fullPath) && !fs.existsSync(fullPath)) {
        fullPath += '.html';
    }

    // Check if file exists
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        console.log(`404: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
    }

    // Get MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            console.log(`Error reading ${filePath}:`, err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
            return;
        }

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
        console.log(`200: ${filePath}`);
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}\n`);
    console.log(`Serving files from: ${OUTPUT_DIR}\n`);
});
