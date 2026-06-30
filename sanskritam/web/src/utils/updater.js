// GitHub update mechanism for web app
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
// Replace with your actual repo
const GITHUB_REPO = 'your-username/sanskritam-database';
const BRANCH = 'main';

// Local storage key for version
const VERSION_KEY = 'sanskritam_db_version';

export async function checkForUpdates() {
    try {
        const localVersion = localStorage.getItem(VERSION_KEY) || '0.0.0';

        // Fetch remote version.json
        const versionUrl = `${GITHUB_RAW_BASE}/${GITHUB_REPO}/${BRANCH}/version.json`;
        const response = await fetch(versionUrl);

        if (!response.ok) {
            console.log('Could not check for updates');
            return { updateAvailable: false };
        }

        const remoteVersion = await response.json();

        if (compareVersions(remoteVersion.version, localVersion) > 0) {
            return {
                updateAvailable: true,
                currentVersion: localVersion,
                newVersion: remoteVersion.version,
                releaseNotes: remoteVersion.releaseNotes || '',
                databaseUrl: remoteVersion.databaseUrl,
            };
        }

        return { updateAvailable: false, currentVersion: localVersion };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { updateAvailable: false, error: error.message };
    }
}

export async function downloadAndApplyUpdate(databaseUrl, db) {
    try {
        // Download new database
        const response = await fetch(databaseUrl);
        if (!response.ok) {
            throw new Error('Failed to download database');
        }

        const buffer = await response.arrayBuffer();

        // Create new database from buffer
        const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });

        const newDb = new SQL.Database(new Uint8Array(buffer));

        // Get new version
        const versionResult = newDb.exec('SELECT version FROM db_version WHERE id = 1');
        const newVersion = versionResult[0]?.values[0]?.[0] || '1.0.0';

        // Store in IndexedDB for persistence
        await saveToIndexedDB(buffer);

        // Update local version
        localStorage.setItem(VERSION_KEY, newVersion);

        return { success: true, newVersion };
    } catch (error) {
        console.error('Error applying update:', error);
        return { success: false, error: error.message };
    }
}

async function saveToIndexedDB(buffer) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SanskritamDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('database')) {
                db.createObjectStore('database');
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['database'], 'readwrite');
            const store = transaction.objectStore('database');
            store.put(buffer, 'main');
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };

        request.onerror = () => reject(request.error);
    });
}

export async function loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SanskritamDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('database')) {
                db.createObjectStore('database');
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['database'], 'readonly');
            const store = transaction.objectStore('database');
            const getRequest = store.get('main');

            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
        };

        request.onerror = () => reject(request.error);
    });
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;

        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }

    return 0;
}
