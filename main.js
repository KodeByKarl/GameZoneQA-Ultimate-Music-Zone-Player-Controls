try {
    const GENERIC_FATAL_MSG = "FATAL: Application integrity check failed. Execution aborted.";

    const garbage1 = Symbol(Math.random().toString());
    const garbage2 = { [Math.random()]: Math.random() };
    const garbage3 = () => Math.random();

    // 1. Behavioral Test: crypto.verify
    let verifyHooked = false;
    try {
        require('crypto').verify(garbage1, garbage2, garbage3, garbage1);
        verifyHooked = true; 
    } catch (e) {
        if (e.name !== 'TypeError') verifyHooked = true; 
    }
    
    if (verifyHooked) {
        console.error(GENERIC_FATAL_MSG);
        process.abort();
    }
    let createVerifyHooked = false;
    try {
        const verifier = require('crypto').createVerify('SHA256');
        verifier.verify(garbage2, garbage3);
        createVerifyHooked = true;
    } catch (e) {
        if (e.name !== 'TypeError') createVerifyHooked = true;
    }

    if (createVerifyHooked) {
        console.error(GENERIC_FATAL_MSG);
        process.abort();
    }
    Object.defineProperty(JSON, 'parse', { writable: false, configurable: false });

} catch (e) {
    console.error("FATAL: Application integrity check failed. Execution aborted.");
    process.abort();
}
// -------------------------------------------------------------------------
// your-app-name/main.js
const util = require('util');
const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu, shell, session } = require('electron');
const path = require('path');
const fs =require('fs'); // Node.js file system module
const fsPromises = fs.promises; // For promise-based fs operations
const got = require('got');
const cheerio = require('cheerio');
const vdf = require('vdf'); // Ensure vdf is required
const AdmZip = require('adm-zip');
const extractZip = require('extract-zip');
const yauzl = require('yauzl');
const { exec, execFile, execSync, spawn } = require('child_process');
const os = require('os');
const { pipeline } = require('stream/promises');
const { machineIdSync } = require('node-machine-id'); // Added for HWID
const crypto = require('crypto'); 

const { net } = require('electron');

async function robustFetchJson(url) {
    try {
        return await new Promise((resolve, reject) => {
            const request = net.request(url);
            request.on('response', (response) => {
                let body = '';
                response.on('data', (chunk) => { body += chunk.toString(); });
                response.on('end', () => {
                    if (response.statusCode === 200) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (err) {
                            reject(new Error('JSON parse error: ' + err.message));
                        }
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}`));
                    }
                });
            });
            request.on('error', (err) => { reject(err); });
            request.end();
        });
    } catch (netErr) {
        console.warn(`[net.request] Failed to fetch ${url}, falling back to got. Error:`, netErr.message);
        return await got(url).json();
    }
}

async function robustFetchText(url) {
    try {
        return await new Promise((resolve, reject) => {
            const request = net.request(url);
            request.on('response', (response) => {
                let body = '';
                response.on('data', (chunk) => { body += chunk.toString(); });
                response.on('end', () => {
                    if (response.statusCode === 200) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}`));
                    }
                });
            });
            request.on('error', (err) => { reject(err); });
            request.end();
        });
    } catch (netErr) {
        console.warn(`[net.request] Failed to fetch text ${url}, falling back to got. Error:`, netErr.message);
        const response = await got(url);
        return response.body;
    }
}

// --- Constants ---
const APP_VERSION = app.getVersion();
const VERSION_URL_INTERNAL = "https://raw.githubusercontent.com/gamezonqa/publuaguifest/refs/heads/main/auth/gamezone_version.txt";
// Internal constants, not to be logged directly
const AUTH_URL_INTERNAL = "https://www.dropbox.com/scl/fi/bbk9jxbkn4f9q0w6q5pss/auth.txt?rlkey=2mrw87ul4puyzuwyyk2btqz0g&st=8imocadv&dl=1";
const README_URL_INTERNAL = "https://www.dropbox.com/scl/fi/wo4d5ttee0pyhuvqzkmn3/ReadMeFirst.txt?rlkey=7i79igfylfg5ukcl6r7xalken&st=c468dpqc&dl=1";
const SOURCE6_URL_INTERNAL = "https://generator.ryuu.lol/secure_download";
const OLD_STEAM_URL_INTERNAL = "https://www.dropbox.com/scl/fi/byi062ajp7it71fzyqxxe/Steam32bit.zip?rlkey=pq7jrilw0xvv77ra2zdt53fnm&st=9r78g0yu&dl=1";
const STEAM_FIX_URL_INTERNAL = "https://raw.githubusercontent.com/luamikare/publuaguifest/main/passby/steamfix.zip";

const REPO_REYAFIRA_INTERNAL = "reyarepo/reyafira"; // Online-Fix Source
const REPO_GAMEPRIV_INTERNAL = "luffynavi/navialuffya"; // Source 1 (Premium) — prioritized download source
const DEPOTBOX_URL_INTERNAL = "https://depotbox.org/api/direct-download";
const DEPOTBOX_API_KEY_INTERNAL = "99b31c3d-0758-42a2-95e0-83d0c3d1af0e";
const ZONE_PLAY_GAMES_URL_INTERNAL = "https://raw.githubusercontent.com/luamikare/publuaguifest/refs/heads/main/passby/steamrip_all_games.json";

const LUA_FOLDER_PATH_BASE_INTERNAL = app.getPath('userData');
const LUA_FOLDER_NAME_INTERNAL = 'GameZoneQAUltimate'; // Generic name is okay for internal use, not logged
const LUA_FOLDER_PATH_INTERNAL = path.join(LUA_FOLDER_PATH_BASE_INTERNAL, LUA_FOLDER_NAME_INTERNAL);
const AUTH_FILE_PATH_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'authorization.txt'); // Filename is okay, path not logged
let CUSTOM_DOWNLOADS_PATH_CONFIG_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'custom_downloads_path.txt');
let AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'auto_place_toggle.json');
let ONLINE_GAME_PATHS_CONFIG_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'online_game_paths.json');
let DLC_TOGGLE_CONFIG_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'dlc_toggle.json');
let DLC_ADDED_STATE_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'dlc_added_state.json');
let ZONE_PLAY_INSTALLS_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'zone_play_installs.json');

function updateConfigFilePaths() {
    const configPath = getSteamConfigPath();
    const targetDir = configPath ? path.join(configPath, 'stplug-in') : LUA_FOLDER_PATH_INTERNAL;
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
        try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
    }
    
    CUSTOM_DOWNLOADS_PATH_CONFIG_FILE_INTERNAL = path.join(targetDir, 'custom_downloads_path.txt');
    AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL = path.join(targetDir, 'auto_place_toggle.json');
    ONLINE_GAME_PATHS_CONFIG_FILE_INTERNAL = path.join(targetDir, 'online_game_paths.json');
    DLC_TOGGLE_CONFIG_FILE_INTERNAL = path.join(targetDir, 'dlc_toggle.json');
    DLC_ADDED_STATE_FILE_INTERNAL = path.join(targetDir, 'dlc_added_state.json');
}
const STEAMTOOLS_LUA_FILENAME_INTERNAL = 'Steamtools.lua'; // Generic filename, okay
const CHART_CACHE_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'chart_cache.json');
const CHART_CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 Hours in milliseconds
const CHART_CACHE_SCHEMA_VERSION = 3;

// Cached AppID -> name list (community-maintained, games only). Lets the library/
// online views resolve names without hitting the rate-limited appdetails API.
const APPID_NAME_LIST_URL_INTERNAL = 'https://raw.githubusercontent.com/jsnli/steamappidlist/refs/heads/master/data/games_appid.json';
const APPID_NAME_CACHE_FILE_INTERNAL = path.join(LUA_FOLDER_PATH_INTERNAL, 'appid_name_cache.json');
const APPID_NAME_REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // Min gap between miss-triggered re-downloads (6h)

const DESKTOP_PATH_INTERNAL = app.getPath('desktop');
const DOWNLOADS_FOLDER_NAME_FOR_DESKTOP_INTERNAL = 'steam'; // Generic name
const DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL = path.join(DESKTOP_PATH_INTERNAL, DOWNLOADS_FOLDER_NAME_FOR_DESKTOP_INTERNAL);

// Steam API Constants - Internal, not logged directly
const STEAM_API_BASE_INTERNAL = {
    appdetails: 'https://store.steampowered.com/api/appdetails',
    storesearch: 'https://store.steampowered.com/api/storesearch',
    featuredcategories: 'https://store.steampowered.com/api/featuredcategories'
};
const STEAM_CDN_BASE_URL_INTERNAL = 'https://cdn.akamai.steamstatic.com/steam/apps/';
const GAMELIST_POPULAR_CATEGORY_TAGS = {
    Action: '19',
    Adventure: '21',
    Casual: '597',
    Indie: '492',
    RPG: '122',
    Racing: '699',
    Simulation: '599',
    Sports: '701',
    Strategy: '9'
};

// Registry Constants for Unlock Game - Path is specific but standard for the feature
const STEAMTOOLS_REG_PATH_INTERNAL = 'HKCU\\Software\\Valve\\Steamtools';
const REG_ACTIVATE_UNLOCK_MODE_INTERNAL = 'ActivateUnlockMode';
const REG_ALWAYS_STAY_UNLOCKED_INTERNAL = 'AlwaysStayUnlocked';


let effectiveSteamDownloadsPath = DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL;
let autoPlaceFilesEnabled = false; // User's preference from config
let dlcModeEnabled = false;        // User's preference from config
let unlockGameModeEnabled = false; // Global state for Unlock Game toggle

let isUserPremium = false; // Global premium status
let isAuthenticated = false;
let globalUserStatus = 'free';
let globalTrialDays = 0;

function watchZoneHasAccess() {
    return isAuthenticated && isUserPremium && (globalUserStatus === 'premium' || globalUserStatus === 'trial');
}

// In-memory AppID -> name map and its load state (see APPID_NAME_* constants).
let appidNameMap = null;             // { [appid:string]: name }
let appidNameFetchedAt = 0;          // ms timestamp of the currently loaded list
let appidNameRefreshInFlight = null; // de-dupes concurrent re-downloads

let mainWindow;
let youtubeMusicBrowserView = null;
let youtubeMusicBrowserViewAttached = false;
let youtubeMusicAdBlockInstalled = false;
let youtubeMusicLastBounds = null;

function refreshYouTubeMusicViewBounds() {
    if (!mainWindow || mainWindow.isDestroyed() || !youtubeMusicBrowserView || !youtubeMusicBrowserViewAttached || !youtubeMusicLastBounds) return;
    const [contentWidth, contentHeight] = mainWindow.getContentSize();
    const { x, y, width, height } = youtubeMusicLastBounds;
    const nextWidth = Math.max(0, Math.min(contentWidth - x, width));
    const nextHeight = Math.max(0, Math.min(contentHeight - y, height));
    if (nextWidth > 0 && nextHeight > 0) youtubeMusicBrowserView.setBounds({ x, y, width: nextWidth, height: nextHeight });
}
let currentSteamId = null; // Used by 'process-appid' and 'process-library-item-update'
let currentGameName = null; // Used by 'process-appid' and 'process-library-item-update'
let detectedSteamPath = null; // This will be handled carefully in logs

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1BsBi2OpcrNNcrsxiNx6
Jmo8+9QmWRo9Ml/9T6kHvb931wWERrCbSziRDbCp/ESKt2ctioJksIYcQdhUugvA
GBCiTpX0/Zq8kh91k1QcdAtOcsUSXsHtAe0f+37DCIXIglFrEMviyXptIsJ3ks25
VeJhmjKn5TWsT+0EPJFi9JUkZwW7/P2RoV8I1J1/ZnThkxMgv0MljsuAo5bR0hD5
x6arzz/CI7fnyUNznRViZpRhd0XGgBXSD3BsARz+k/+AtLDKhqLdizrLfreTwZ5q
6JN9lgdekTKrwkLCpI3hB6RENMGUfeHnWaA9+sMBuEUFOw4hW59G4gbYiryZfhLK
BwIDAQAB
-----END PUBLIC KEY-----`;

function verifyAndParseResponse(rawBody, signatureHeader) {
    if (!rawBody || !signatureHeader) throw new Error("Invalid response");
    
    const isVerified = crypto.verify(
        'sha256',
        Buffer.from(rawBody),
        PUBLIC_KEY,
        Buffer.from(signatureHeader, 'base64')
    );

    if (!isVerified) {
        throw new Error("Security Violation: Response signature mismatch");
    }

    return JSON.parse(rawBody);
}

// --- Utility Functions ---
// --- ANTI-TAMPER FORCE LOGOUT ---
async function forceLogoutTamperDetected() {
    console.warn("SECURITY WARNING: Unauthenticated action attempted. Forcing logout.");
    
    // 1. Ensure backend variables are strictly locked
    isAuthenticated = false;
    isUserPremium = false;
    globalUserStatus = 'free';
    watchZoneClosePlayer();
    
    // 2. Send an angry red message to the logs
    sendStatus('Security Violation: Unauthorized tampering detected.', 'error');
    
    // 3. FORCE THE FRONTEND BACK TO THE LOGIN SCREEN
    if (mainWindow) {
        mainWindow.webContents.send('auth-result', { 
            success: false, 
            message: 'Unauthorized access detected.', 
            readmeText: 'Please log in with a valid code.', 
            isPremium: false, 
            expirationInfo: null 
        });
    }
}



// Utility functions for Windows Registry
async function readSteamToolsRegistryValue(valueName) {
    if (process.platform !== 'win32') {
        return null; // Feature is Windows-specific
    }
    return new Promise((resolve) => {
        const command = `reg query "${STEAMTOOLS_REG_PATH_INTERNAL}" /v ${valueName}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Don't log specific registry paths in errors
                if (stderr && (stderr.toLowerCase().includes('unable to find the specified registry key or value') ||
                               stderr.toLowerCase().includes('the system was unable to find the specified registry key or value') ||
                               stderr.toLowerCase().includes('cannot find'))) {
                    resolve(null);
                } else {
                    resolve(null);
                }
                return;
            }
            const HKEY_pattern = new RegExp(`^\\s*${valueName}\\s+REG_SZ\\s+(.+)$`, 'im');
            const match = stdout.match(HKEY_pattern);

            if (match && match[1]) {
                resolve(match[1].trim().toLowerCase());
            } else {
                resolve(null);
            }
        });
    });
}
// Safely reads and parses the online game paths JSON file.
async function readOnlinePathsFile() {
    try {
        if (fs.existsSync(ONLINE_GAME_PATHS_CONFIG_FILE_INTERNAL)) {
            const fileContent = await fsPromises.readFile(ONLINE_GAME_PATHS_CONFIG_FILE_INTERNAL, 'utf-8');
            return JSON.parse(fileContent);
        }
    } catch (error) {
        console.warn('Configuration Error: Could not read or parse online game paths file. A new one will be created.');
        sendStatus('Warning: Could not read online game paths config. It may be reset.', 'warning');
    }
    return {}; // Return empty object if file doesn't exist or is corrupt
}

// Safely writes data to the online game paths JSON file.
async function writeOnlinePathsFile(data) {
    try {
        await fsPromises.writeFile(ONLINE_GAME_PATHS_CONFIG_FILE_INTERNAL, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Configuration Error: Failed to write to online game paths file.');
        sendStatus('Error: Could not save online game path configuration.', 'error');
        return false;
    }
}

async function readDlcAddedState() {
    try {
        if (fs.existsSync(DLC_ADDED_STATE_FILE_INTERNAL)) {
            return JSON.parse(await fsPromises.readFile(DLC_ADDED_STATE_FILE_INTERNAL, 'utf-8'));
        }
    } catch (e) { /* corrupt/missing - start fresh */ }
    return {};
}

async function setDlcAddedState(appId, added) {
    try {
        const data = await readDlcAddedState();
        if (added) data[String(appId)] = true;
        else delete data[String(appId)];
        await fsPromises.writeFile(DLC_ADDED_STATE_FILE_INTERNAL, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.warn('Could not persist DLC toggle state:', e.message);
    }
}

async function writeSteamToolsRegistryValue(valueName, valueDataString) {
    if (process.platform !== 'win32') {
        return false;
    }
    return new Promise((resolve, reject) => {
        const createKeyCommand = `reg add "${STEAMTOOLS_REG_PATH_INTERNAL}" /f`;
        exec(createKeyCommand, (createError) => {
            if (createError) {
                // Error creating key, don't log specific path
            }

            const command = `reg add "${STEAMTOOLS_REG_PATH_INTERNAL}" /v ${valueName} /t REG_SZ /d "${valueDataString}" /f`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to write registry value.`)); // Generic error
                    return;
                }
                resolve(true);
            });
        });
    });
}

// Replace the old getSecret/genshinreya block with this:

// Paste the contents of public_key.pem here


// Keep genshinreya ONLY for the generateAuthToken (requests going TO the server)
// We use the same numerical array so your Vercel server's verifyOneTimeToken still works.
const genshinreya = String.fromCharCode(...[52, 53, 97, 97, 52, 49, 53, 56, 51, 97, 99, 53, 97, 56, 56, 49, 101, 102, 50, 53, 55, 98, 54, 97, 52, 54, 56, 49, 48, 52, 97, 101]);

// Helper to generate JWT
function generateAuthToken() {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        jti: crypto.randomUUID(), // Unique Request ID
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 // Expires in 30 seconds
    };

    const base64UrlEncode = (obj) => {
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);

    const signature = crypto.createHmac('sha256', genshinreya)
        .update(encodedHeader + '.' + encodedPayload)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}



// Function to load initial state for Unlock Game toggle
async function loadInitialUnlockGameState() {
    if (process.platform !== 'win32') {
        unlockGameModeEnabled = false;
        if (mainWindow) mainWindow.webContents.send('unlock-game-state-update', false);
        return;
    }
    try {
        const activateUnlock = await readSteamToolsRegistryValue(REG_ACTIVATE_UNLOCK_MODE_INTERNAL);
        const alwaysStay = await readSteamToolsRegistryValue(REG_ALWAYS_STAY_UNLOCKED_INTERNAL);
        unlockGameModeEnabled = (activateUnlock === 'true' && alwaysStay === 'true');
    } catch (err) {
        unlockGameModeEnabled = false;
    }
    if (mainWindow) mainWindow.webContents.send('unlock-game-state-update', unlockGameModeEnabled);
}


async function loadDlcToggleState() {
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        if (fs.existsSync(DLC_TOGGLE_CONFIG_FILE_INTERNAL)) {
            const data = fs.readFileSync(DLC_TOGGLE_CONFIG_FILE_INTERNAL, 'utf8');
            const config = JSON.parse(data);
            dlcModeEnabled = !!config.enabled;
        } else {
            dlcModeEnabled = false;
            fs.writeFileSync(DLC_TOGGLE_CONFIG_FILE_INTERNAL, JSON.stringify({ enabled: false }));
        }
    } catch (err) {
        console.warn("Configuration Error: Problem loading DLC toggle state."); // Generic console log
        sendStatus(`Error loading DLC mode toggle state. Defaulting to OFF`, 'warning');
        dlcModeEnabled = false;
    }
}

async function loadAutoPlaceToggleState() {
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        if (fs.existsSync(AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL)) {
            const data = fs.readFileSync(AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL, 'utf8');
            const config = JSON.parse(data);
            autoPlaceFilesEnabled = !!config.enabled;
        } else {
            autoPlaceFilesEnabled = false;
            fs.writeFileSync(AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL, JSON.stringify({ enabled: false }));
        }
    } catch (err) {
        console.warn("Configuration Error: Problem loading auto-place toggle state."); // Generic console log
        sendStatus(`Error loading auto-save toggle state. Defaulting to OFF`, 'warning');
        autoPlaceFilesEnabled = false;
    }
}

async function loadAndSetDownloadsPath() {
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        if (fs.existsSync(CUSTOM_DOWNLOADS_PATH_CONFIG_FILE_INTERNAL)) {
            const customPath = fs.readFileSync(CUSTOM_DOWNLOADS_PATH_CONFIG_FILE_INTERNAL, 'utf8').trim();
            if (customPath && fs.existsSync(customPath) && fs.lstatSync(customPath).isDirectory()) {
                effectiveSteamDownloadsPath = customPath; return;
            } else if (customPath) sendStatus(`Custom save location not found or invalid. Reverting to default.`, 'warning');
        }
    } catch (err) {
        console.warn("Configuration Error: Problem loading custom downloads path settings."); // Generic console log
        sendStatus(`Error loading custom save location. Using default.`, 'warning');
    }
    effectiveSteamDownloadsPath = DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL;
}

function sendStatus(message, type = 'info') {
    if (mainWindow) mainWindow.webContents.send('status-update', message, type);
    // Avoid logging raw paths/URLs to console, use generic messages if needed for console
    const consoleSafeMessage = message.replace(/([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*)([^\\/:*?"<>|\r\n]*)/gi, '[DRIVE]:\\[PATH]\\[FILE]');
    if (type !== 'error' && type !== 'warning' && !consoleSafeMessage.startsWith("Chart:")) console.log(`[${type.toUpperCase()}] ${consoleSafeMessage}`);
    else if (consoleSafeMessage.startsWith("Chart:") && (type === 'info' || type === 'progress')) console.log(`[CHART-${type.toUpperCase()}] ${consoleSafeMessage.substring(7)}`);
}

function showThemedMessage(title, message, type = 'error') {
    const modalTitle = String(title || 'Message');
    const modalMessage = String(message || '');
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
        mainWindow.webContents.send('show-themed-message', { title: modalTitle, message: modalMessage, type });
        return;
    }
    if (dialog) dialog.showErrorBox(modalTitle, modalMessage);
}


function sendDlcStatus(message, type = 'info') {
    if (mainWindow) mainWindow.webContents.send('dlc-operation-status', message, type);
    const consoleSafeMessage = message.replace(/([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*)([^\\/:*?"<>|\r\n]*)/gi, '[DRIVE]:\\[PATH]\\[FILE]');
    if (type !== 'error' && type !== 'warning') console.log(`[DLC-${type.toUpperCase()}] ${consoleSafeMessage}`);
}

async function finishDlcToggle(appId, added) {
    await setDlcAddedState(appId, added);
    if (mainWindow) mainWindow.webContents.send('dlc-toggle-result', { appId: String(appId), added: !!added });
}


function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'UnnamedGame';
    // This is for creating filenames, not logging, so it's okay.
    return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function clearFolder(folderPathInternal) { // Parameter name indicates internal use
    try {
        if (fs.existsSync(folderPathInternal)) await fsPromises.rm(folderPathInternal, { recursive: true, force: true });
        await fsPromises.mkdir(folderPathInternal, { recursive: true });
    } catch (err) {
        console.warn("File System Error: Could not clear or create a required application folder."); // Generic
        sendStatus("A problem occurred while preparing application directories.", "error");
        throw new Error("Failed to clear/create internal folder."); // Generic throw
    }
}

async function findFilesRecursive(dirInternal, extension) { // Parameter name indicates internal use
    const foundFiles = [];
    async function recurse(currentPathInternal) {
        try {
            const dirents = await fsPromises.readdir(currentPathInternal, { withFileTypes: true });
            for (const dirent of dirents) {
                const res = path.resolve(currentPathInternal, dirent.name);
                if (dirent.isDirectory()) await recurse(res);
                else if (dirent.name.toLowerCase().endsWith(extension)) foundFiles.push(res); // res (full path) is not logged
            }
        } catch (err) {
            console.warn("File System Error: Problem during recursive file search."); // Generic
            sendStatus(`Warning: A problem occurred while searching for files. Some files may not be found.`, 'warning');
        }
    }
    await recurse(dirInternal); return foundFiles;
}

async function getBlockedDrms() {
    try {
        const responseText = await got(BLOCKED_DRM_URL_INTERNAL, { timeout: { request: 10000 } }).text();
        return new Set(responseText.split('\n').map(line => line.trim().toLowerCase()).filter(Boolean));
    } catch (e) {
        console.warn("Network Error: Failed to fetch restriction list."); // Generic
        sendStatus('Failed to fetch restriction list. Using defaults.', 'warning');
        return new Set(['denuvo', 'rockstar games', 'ea online', 'activation', 'ubisoft account', 'activision', 'xbox live', 'battle.net', 'uplay']);
    }
}

async function getReadmeText() {
    try {
        const response = await got(README_URL_INTERNAL, { timeout: { request: 10000 } });
        return response.body.trim(); // Actual text is fine, it's meant to be displayed
    } catch (e) {
        console.warn('Network Warning: Failed to fetch auxiliary text.'); // Generic
        return "Could not fetch auxiliary information. Default: This tool is not for sale. If you bought it, you have been scammed. More info available via official channels.";
    }
}

async function postAuthSetup(isPremiumUserStatus, expirationDisplayInfo = null, userStatus = 'free', trialDays = 0) {
    isUserPremium = isPremiumUserStatus;
    isAuthenticated = true;
    globalUserStatus = userStatus;
    globalTrialDays = trialDays;
    if (!watchZoneHasAccess()) watchZoneClosePlayer();
    sendStatus(effectiveSteamDownloadsPath === DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL ?
        `Using default save location.` :
        `Using custom save location.`, 'info');
    try {
        if (!fs.existsSync(effectiveSteamDownloadsPath)) fs.mkdirSync(effectiveSteamDownloadsPath, { recursive: true });
    } catch (err) {
        console.warn("File System Error: Error setting up the downloads folder."); // Generic
        sendStatus(`Error setting up the downloads folder. Please check settings.`, 'error');
        showThemedMessage("Downloads Folder Error", `Failed to create/access target directory. Please check system settings.`);
    }


    if (!isUserPremium) sendStatus('Limited access. Upgrade for enhanced capabilities!', 'warning');
    else sendStatus('Premium activated! Explore without limits', 'success');

    detectedSteamPath = await findSteamPath(); // detectedSteamPath itself won't be logged raw
    updateConfigFilePaths();
    if (detectedSteamPath) {
        sendStatus(`Game platform installation detected.`, 'info');
        if (mainWindow) mainWindow.webContents.send('steam-control-ready');
    } else {
        sendStatus('Game platform installation not automatically detected. Related features may be limited', 'warning');
         if (process.platform === 'darwin' && fs.existsSync(path.join(os.homedir(), 'Library', 'Application Support', 'Steam'))) { // Standard OSX path check is okay
            sendStatus('macOS game platform data directory found; some features might work', 'info');
            if (mainWindow) mainWindow.webContents.send('steam-control-ready');
        }
    }
    if (mainWindow) {
        mainWindow.webContents.send('auth-result', { 
            success: true, 
            isPremium: isUserPremium, 
            expirationInfo: expirationDisplayInfo,
            userStatus: globalUserStatus,
            trialDays: globalTrialDays
        });
        // Send generic strings for path
        const savePathString = effectiveSteamDownloadsPath === DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL ? "Default Location" : "Custom Location";
        mainWindow.webContents.send('current-save-path', savePathString);
        mainWindow.webContents.send('auto-save-state-update', autoPlaceFilesEnabled);
        mainWindow.webContents.send('dlc-mode-state-update', dlcModeEnabled);
        mainWindow.webContents.send('unlock-game-state-update', unlockGameModeEnabled);
    }
}

// --- Core Logic Functions ---
async function checkDatabaseExists(steamId) {
    if (!isUserPremium) {
        sendStatus('No Game Found (Buy Upgrade $10 Lifetime)', 'error');
        return false;
    }

    const source1TestUrlInternal = `https://api.github.com/repos/${REPO_GAMEPRIV_INTERNAL}/contents/${steamId}.zip?ref=main`;
    try {
        await got.head(source1TestUrlInternal, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Mozilla/5.0' },
            timeout: { request: 5000 }
        });
        return 'SOURCE_1';
    } catch (s1Error) {
        // Fallback to next database source
    }

    const source2TestUrlInternal = `${DEPOTBOX_URL_INTERNAL}?appid=${steamId}&api_key=${DEPOTBOX_API_KEY_INTERNAL}`;
    try {
        await got.head(source2TestUrlInternal, { timeout: { request: 5000 } });
        return 'SOURCE_2';
    } catch (s2Error) {
        // Fallback to next database source
    }

    const source6TestUrlInternal = `${SOURCE6_URL_INTERNAL}?appid=${steamId}&auth_code=luamanifest`;
    try {
        await got.head(source6TestUrlInternal, { timeout: { request: 5000 } });
        return 'SOURCE_6';
    } catch (s6Error) {
        if (s6Error.response?.statusCode === 404) {
            sendStatus(`Game data not found for AppID ${steamId}`, 'error');
        } else {
            sendStatus('Data source check failed: Could not connect.', 'warning');
        }
        return false;
    }
}

// --- Cached AppID -> name lookup (jsnli/steamappidlist) ---------------------
// The library/online views only need name + appid + a CDN image, so they read
// names from this cached list instead of hammering the rate-limited appdetails
// API. A missing id triggers at most one re-download per
// APPID_NAME_REFRESH_MIN_INTERVAL_MS, then falls back to the API for that id.

async function downloadAppidNameMap() {
    const response = await got(APPID_NAME_LIST_URL_INTERNAL, {
        responseType: 'json',
        timeout: { request: 30000 },
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const list = Array.isArray(response.body) ? response.body : [];
    const map = Object.create(null);
    for (const entry of list) {
        if (entry && entry.appid != null) map[String(entry.appid)] = entry.name || '';
    }
    appidNameMap = map;
    appidNameFetchedAt = Date.now();
    try {
        await fsPromises.writeFile(APPID_NAME_CACHE_FILE_INTERNAL,
            JSON.stringify({ fetchedAt: appidNameFetchedAt, map }));
    } catch (e) { /* cache write is best-effort */ }
    return appidNameMap;
}

async function refreshAppidNameMap() {
    // Coalesce concurrent callers (a library refresh fans out over many appids).
    if (!appidNameRefreshInFlight) {
        appidNameRefreshInFlight = downloadAppidNameMap()
            .catch(e => { console.warn('AppID name list refresh failed.'); return appidNameMap || Object.create(null); })
            .finally(() => { appidNameRefreshInFlight = null; });
    }
    return appidNameRefreshInFlight;
}

async function ensureAppidNameMap() {
    if (appidNameMap) return appidNameMap;
    try {
        const raw = await fsPromises.readFile(APPID_NAME_CACHE_FILE_INTERNAL, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.map) {
            appidNameMap = parsed.map;
            appidNameFetchedAt = parsed.fetchedAt || 0;
            return appidNameMap;
        }
    } catch (e) { /* no usable cache on disk yet */ }
    return refreshAppidNameMap();
}

async function getCachedGameName(appId) {
    const key = String(appId);
    await ensureAppidNameMap();
    if (appidNameMap[key]) return appidNameMap[key];
    // Miss: re-download the latest list at most once per interval, then retry.
    if (Date.now() - appidNameFetchedAt > APPID_NAME_REFRESH_MIN_INTERVAL_MS) {
        await refreshAppidNameMap();
        if (appidNameMap[key]) return appidNameMap[key];
    }
    return null;
}

// Lightweight game info for the library/online list views: cached name + a
// direct CDN image, with no appdetails call unless the id is absent from the
// games list entirely (rare: DLC/tool/etc.).
async function getLibraryGameInfo(appId) {
    const key = String(appId);
    let name = await getCachedGameName(key);
    if (!name) {
        const apiInfo = await scrapeSteamGameInfo(key); // one API call for this id only
        name = apiInfo.name;
        if (apiInfo.name && !apiInfo.name.startsWith('AppID:') && appidNameMap) {
            appidNameMap[key] = apiInfo.name; // remember it for the rest of this session
        }
    }
    return {
        appId: key,
        name: name || `AppID: ${key}`,
        imageUrl: `${STEAM_CDN_BASE_URL_INTERNAL}${key}/header.jpg`
    };
}

async function scrapeSteamGameInfo(appId) {
    const apiUrlInternal = `${STEAM_API_BASE_INTERNAL.appdetails}?appids=${appId}&cc=us&l=en`;
    let gameName = `AppID: ${appId}`;
    let imageUrl = ''; // Image URL itself is not logged, just used for display
    let error = null;
    let isApiErrorNotFound = false;
    let apiData = null;

    try {
        const response = await got(apiUrlInternal, {
            timeout: { request: 15000 },
            responseType: 'json',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const appDataContainer = response.body?.[appId] || Object.values(response.body || {}).find(
            entry => entry?.data && String(entry.data.steam_appid) === String(appId)
        );
        if (appDataContainer) {
            if (appDataContainer.success && appDataContainer.data) {
                apiData = appDataContainer.data;
                gameName = sanitizeFilename(apiData.name || `AppID: ${appId}`); // sanitizeFilename is fine
                imageUrl = apiData.header_image || '';
            } else if (appDataContainer.success === false) {
                error = "Game platform API reported failure for this AppID (e.g., not found)."; // Generic error
                gameName = `AppID: ${appId} (API Error/Not Found)`;
                isApiErrorNotFound = true;
            } else {
                error = "Limited data from game platform API.";
            }
        } else {
            error = "Invalid or no response from game platform API for this AppID.";
            gameName = `AppID: ${appId} (API Invalid Response)`;
            isApiErrorNotFound = true;
        }
    } catch (e) {
        console.warn(`Network Error: Problem scraping AppID ${appId} via game info API.`); // Generic console log
        error = `Network error fetching game data. Connection issue suspected.`;
        if (e.name === 'TimeoutError' || e.code === 'ENOTFOUND' || e.code === 'ECONNRESET') {
             isApiErrorNotFound = true;
             gameName = `AppID: ${appId} (API Network Error)`;
        }
    }
    return { appId, name: gameName, imageUrl, error, isApiErrorNotFound, data: apiData };
}


async function checkDrm(steamId, suppressMainLog = false) {
    let localGameName = `App${steamId}`;
    const apiInfoForName = await scrapeSteamGameInfo(steamId);
    localGameName = apiInfoForName.name;

    if (!suppressMainLog) {
        currentGameName = localGameName;
    }

    if (apiInfoForName.isApiErrorNotFound && !apiInfoForName.name.includes('(API Network Error)')) {
        return { status: 'invalid_api', gameName: localGameName };
    }

    try {
        const storePageUrlInternal = `https://store.steampowered.com/app/${steamId}/`; // Internal, not logged

        if (!suppressMainLog) {
            sendStatus(`Checking restrictions for ${localGameName}`);
        }
        const response = await got(storePageUrlInternal, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en', 'Cookie': 'birthtime=1; wants_mature_content=1; steamCountry=US%7C0000000000000000' },
            timeout: { request: 25000 },
            throwHttpErrors: false
        });

        if (response.url.includes('/agecheck/app/')) { // This part of URL is standard, not sensitive itself
             if (!suppressMainLog) sendStatus(`Content restriction page encountered for ${localGameName}`, 'warning');
            return { status: 'age_restricted', gameName: localGameName };
        }

        if (response.statusCode !== 200 && response.statusCode !== 404) {
            if (!suppressMainLog) sendStatus(`Store page for ${localGameName} returned an error.`, 'error'); // Generic
            return { status: 'failed_http_store', gameName: localGameName };
        }

        const $ = cheerio.load(response.body);
        const pageTextLower = $.text().toLowerCase();

        const isInvalidStorePage = pageTextLower.includes('invalid appid') || pageTextLower.includes('invalid app') ||
            (response.statusCode === 404 && (pageTextLower.includes('no items matching your search') || pageTextLower.includes('requested app is not valid')));

        if (isInvalidStorePage) {
            if (!suppressMainLog) sendStatus(`Store page indicates AppID ${steamId} (${localGameName}) is invalid.`, 'error');
            return { status: 'invalid_store', gameName: localGameName };
        }
        if (pageTextLower.includes('unavailable in your region')) {
            if (!suppressMainLog) sendStatus(`Game ${localGameName} (AppID: ${steamId}) has availability issues.`, 'error'); // Generic
            return { status: 'region_locked', gameName: localGameName };
        }

        const appHubNameDiv = $('#appHubAppName, div.apphub_AppName').first();
        if (appHubNameDiv.length) {
            const storePageName = sanitizeFilename(appHubNameDiv.text().trim());
            if (storePageName && storePageName.toLowerCase() !== `appid: ${steamId}`.toLowerCase()) {
                 localGameName = storePageName;
                 if (!suppressMainLog) currentGameName = localGameName;
            }
        } else if (!suppressMainLog) {
             sendStatus(`Could not find App Name on store page for AppID ${steamId}. Using available name: ${localGameName}.`, 'warning');
        }

        if (!suppressMainLog && apiInfoForName.isApiErrorNotFound && apiInfoForName.name.includes('(API Network Error)')) {
            sendStatus(`Store page for ${localGameName} loaded despite initial API network error. Proceeding.`, 'info');
        }

        if (!suppressMainLog) sendStatus(`Game Name: ${localGameName}`, 'success');

        const blockedDrms = await getBlockedDrms();
        const drmSections = $('.DRM_notice, .game_area_drm_notice');
        let content = '';
        drmSections.each((i, el) => { content += ' ' + $(el).text().toLowerCase().trim(); });
        const foundDrms = Array.from(blockedDrms).filter(drm => content.includes(drm));
        if (foundDrms.length) {
            if (!suppressMainLog) sendStatus(`Restriction Notice Found for ${localGameName}.`, 'drm-found'); // Don't list specific DRMs
            return { status: 'drm_found', drms: foundDrms, gameName: localGameName };
        }
        if (!suppressMainLog) sendStatus(`GAME IS PLAYABLE`, 'success');
        return { status: 'success', gameName: localGameName };

    } catch (error) {
        console.warn(`Network/Scraping Error during Store Page Check for AppID ${steamId}.`); // Generic console
        if (!suppressMainLog) sendStatus(`Store Page Check System Error for ${localGameName} (AppID ${steamId}).`, 'error'); // Generic
        return { status: 'failed_store_scrape', gameName: localGameName };
    }
}


async function placeFilesInSteamConfigFromTemp(tempSourcePathInternal, sourceIsZip = false, forceAutoSaveFromLibrary = false) {
    if (!forceAutoSaveFromLibrary && !autoPlaceFilesEnabled) {
        return false;
    }
    const steamConfigDirInternal = getSteamConfigPath(); 
    if (!steamConfigDirInternal) {
        const reason = forceAutoSaveFromLibrary ? 'Auto-save (forced for library update)' : 'Auto-save (toggle)';
        sendStatus(`${reason}: Game platform config path not determined`, 'warning');
        return false;
    }

    // --- START OF MODIFIED SECTION ---
    // Use path.dirname to go up one level from 'config' to the Steam root
    const steamRootDirInternal = path.dirname(steamConfigDirInternal);
    
    // stplug-in stays inside config
    const stplugInDirInternal = path.join(steamConfigDirInternal, 'stplug-in');
    // depotcache moves to Steam root
    const depotCacheDirInternal = path.join(steamRootDirInternal, 'depotcache'); 
    // --- END OF MODIFIED SECTION ---
    let finalSourcePath = tempSourcePathInternal; let tempExtractDirForZipInternal;
    try {
        await fsPromises.mkdir(stplugInDirInternal, { recursive: true });
        await fsPromises.mkdir(depotCacheDirInternal, { recursive: true });
        if (sourceIsZip) {
            // Temp paths are fine, not logged
            tempExtractDirForZipInternal = path.join(os.tmpdir(), `app-autoplace-${Date.now()}`);
            await fsPromises.mkdir(tempExtractDirForZipInternal, { recursive: true });
            await extractZip(tempSourcePathInternal, { dir: tempExtractDirForZipInternal });
            finalSourcePath = tempExtractDirForZipInternal;
        }
        const luaFiles = await findFilesRecursive(finalSourcePath, '.lua'); // findFilesRecursive doesn't log paths
        for (const f of luaFiles) { await fsPromises.copyFile(f, path.join(stplugInDirInternal, path.basename(f))); }
        const manifestFiles = await findFilesRecursive(finalSourcePath, '.manifest');
        for (const f of manifestFiles) { await fsPromises.copyFile(f, path.join(depotCacheDirInternal, path.basename(f)));}
        const saveTypeMsg = forceAutoSaveFromLibrary ? 'Auto-save (forced for library update)' : 'Auto-save (toggle)';
        if (luaFiles.length === 0 && manifestFiles.length === 0) {
            sendStatus(`${saveTypeMsg}: No game files found to place.`, 'info');
            return false;
        }
        return true;
    } catch (error) {
        const reason = forceAutoSaveFromLibrary ? 'Error during forced auto-placement (library update)' : 'Error during auto-placement (toggle)';
        console.warn(`File System Error: ${reason}.`); // Generic console
        sendStatus(`${reason}: A file system error occurred during placement.`, 'error');
        return false;
    }
    finally {
        if (tempExtractDirForZipInternal && fs.existsSync(tempExtractDirForZipInternal)) {
            try { await fsPromises.rm(tempExtractDirForZipInternal, { recursive: true, force: true }); } catch (_) {
                console.warn("File System Warning: Could not clean up a temporary directory for auto-placement."); // Generic
            }
        }
    }
}

async function downloadFromGamepriv(steamIdToDownload, forceAutoSaveFromLibrary = false) {
    sendStatus('Attempting download (Source 1)');
    const effectiveGameNameToUse = currentGameName || `App${steamIdToDownload}`;
    const tempDir = os.tmpdir(); // Temp path, not logged
    const tempDownloadedZipPathInternal = path.join(tempDir, `app-s1-${steamIdToDownload}-${Date.now()}.zip`);
    try {
        const apiUrlInternal = `https://api.github.com/repos/${REPO_GAMEPRIV_INTERNAL}/contents/${steamIdToDownload}.zip?ref=main`; let fileDownloadUrlInternal;
        try {
            const apiResponse = await got(apiUrlInternal, { headers: { 'Accept': 'application/vnd.github.v3+json' }, timeout: { request: 15000 }, responseType: 'json' });
            if (apiResponse.body?.download_url) fileDownloadUrlInternal = apiResponse.body.download_url; // URL not logged
            else { sendStatus(`Download resource not found (S1) for AppID ${steamIdToDownload}`, 'error'); return false; }
        } catch (apiError) {
            console.warn(`Network Error: Download prep failed (S1) for AppID ${steamIdToDownload}.`); // Generic console
            if (apiError.response?.statusCode === 404) sendStatus(`Game data not found (S1) for AppID ${steamIdToDownload}`, 'warning');
            else sendStatus(`Download prep failed (S1) for AppID ${steamIdToDownload}.`, 'error');
            return false;
        }
        const downloadStream = got.stream(fileDownloadUrlInternal, { timeout: { request: 300000 }, isStream: true });
        downloadStream.on('downloadProgress', p => sendStatus(`Progress (S1): ${(p.percent * 100).toFixed(1)}% (${(p.transferred/1024/1024).toFixed(2)}MB / ${(p.total ? (p.total/1024/1024).toFixed(2) : '??')}MB)`, 'progress'));
        await pipeline(downloadStream, fs.createWriteStream(tempDownloadedZipPathInternal));

        const placed = await placeFilesInSteamConfigFromTemp(tempDownloadedZipPathInternal, true, forceAutoSaveFromLibrary);

        if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && placed) {
            return true;
        } else if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && !placed) {
            const reason = forceAutoSaveFromLibrary ? "(forced for library update)" : "(toggle)";
            sendStatus(`Auto-Save active ${reason} (S1) but failed or no files were found to place. Saving archive instead.`, 'warning');
        }

        const steamPathToSave = effectiveSteamDownloadsPath;
        if (!fs.existsSync(steamPathToSave)) {
            try {
                fs.mkdirSync(steamPathToSave, { recursive: true });
            } catch (e) {
                console.warn(`File System Error: Error creating target directory.`); // Generic console
                sendStatus(`Error creating target directory. Please check system settings.`, 'error');
                return false;
            }
        }

        const premiumTag = isUserPremium ? 'Premium' : 'Non-Premium';
        const finalZipPathUser = path.join(steamPathToSave, `${sanitizeFilename(effectiveGameNameToUse)} - ${steamIdToDownload} (${premiumTag}).zip`);
        await fsPromises.copyFile(tempDownloadedZipPathInternal, finalZipPathUser);
        sendStatus(`Saved to: ${finalZipPathUser}`, 'success');
        return true;

    } catch (error) {
        console.warn(`Application Error: Download process failed (S1) for AppID ${steamIdToDownload}.`); // Generic console
        sendStatus(`Download process failed (S1) for AppID ${steamIdToDownload}.`, 'error');
        return false;
    }
    finally { if (fs.existsSync(tempDownloadedZipPathInternal)) try { await fsPromises.unlink(tempDownloadedZipPathInternal); } catch (_) {
        console.warn("File System Warning: Could not clean up a temporary downloaded file."); // Generic
    } }
}

async function downloadFromDepotbox(steamIdToDownload, forceAutoSaveFromLibrary = false) {
    sendStatus('Attempting download (Source 2)');
    const effectiveGameNameToUse = currentGameName || `App${steamIdToDownload}`;
    const tempDir = os.tmpdir();
    const tempDownloadedZipPathInternal = path.join(tempDir, `app-s2-${steamIdToDownload}-${Date.now()}.zip`);
    try {
        const downloadUrlInternal = `${DEPOTBOX_URL_INTERNAL}?appid=${steamIdToDownload}&api_key=${DEPOTBOX_API_KEY_INTERNAL}`;
        
        const downloadStream = got.stream(downloadUrlInternal, {
            timeout: { request: 300000 },
            isStream: true
        });

        downloadStream.on('downloadProgress', p => sendStatus(`Progress (S2): ${(p.percent * 100).toFixed(1)}% (${(p.transferred/1024/1024).toFixed(2)}MB / ${(p.total ? (p.total/1024/1024).toFixed(2) : '??')}MB)`, 'progress'));
        await pipeline(downloadStream, fs.createWriteStream(tempDownloadedZipPathInternal));

        const placed = await placeFilesInSteamConfigFromTemp(tempDownloadedZipPathInternal, true, forceAutoSaveFromLibrary);

        if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && placed) {
            return true;
        } else if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && !placed) {
            const reason = forceAutoSaveFromLibrary ? "(forced for library update)" : "(toggle)";
            sendStatus(`Auto-Save active ${reason} (S2) but failed or no files were found to place. Saving archive instead.`, 'warning');
        }

        const steamPathToSave = effectiveSteamDownloadsPath;
        if (!fs.existsSync(steamPathToSave)) {
            try {
                fs.mkdirSync(steamPathToSave, { recursive: true });
            } catch (e) {
                console.warn(`File System Error: Error creating target directory.`);
                sendStatus(`Error creating target directory. Please check system settings.`, 'error');
                return false;
            }
        }

        const premiumTag = isUserPremium ? 'Premium' : 'Non-Premium';
        const finalZipPathUser = path.join(steamPathToSave, `${sanitizeFilename(effectiveGameNameToUse)} - ${steamIdToDownload} (${premiumTag}).zip`);
        await fsPromises.copyFile(tempDownloadedZipPathInternal, finalZipPathUser);
        sendStatus(`Saved to: ${finalZipPathUser}`, 'success');
        return true;

    } catch (error) {
        console.warn(`Application Error: Download process failed (S2) for AppID ${steamIdToDownload}.`);
        if (error instanceof got.HTTPError && error.response && error.response.statusCode === 404) {
            sendStatus(`Game data not found (S2) for AppID ${steamIdToDownload}`, 'warning');
        } else {
            sendStatus(`Download process failed (S2) for AppID ${steamIdToDownload}.`, 'error');
        }
        return false;
    } finally {
        if (fs.existsSync(tempDownloadedZipPathInternal)) {
            try { await fsPromises.unlink(tempDownloadedZipPathInternal); } catch (_) {}
        }
    }
}

async function downloadFromSource6(steamIdToDownload, forceAutoSaveFromLibrary = false) {
    sendStatus('Attempting download (Source 6)');
    const effectiveGameNameToUse = currentGameName || `App${steamIdToDownload}`;
    const tempDir = os.tmpdir();
    const initialDownloadZipPathInternal = path.join(tempDir, `app-s6-initial-${steamIdToDownload}-${Date.now()}.zip`);
    const extractedPathInternal = path.join(tempDir, `app-s6-extracted-${steamIdToDownload}-${Date.now()}`);

    try {
        await clearFolder(extractedPathInternal);

        const downloadUrlInternal = `${SOURCE6_URL_INTERNAL}?appid=${steamIdToDownload}&auth_code=luamanifest`;
        
        const downloadStream = got.stream(downloadUrlInternal, {
            timeout: { request: 300000 },
            isStream: true
        });

        downloadStream.on('downloadProgress', p => sendStatus(`Progress (S6): ${(p.percent * 100).toFixed(1)}% (${(p.transferred/1024/1024).toFixed(2)}MB / ${(p.total ? (p.total/1024/1024).toFixed(2) : '??')}MB)`, 'progress'));
        await pipeline(downloadStream, fs.createWriteStream(initialDownloadZipPathInternal));
        
        await extractZip(initialDownloadZipPathInternal, { dir: extractedPathInternal });

        // Place files using the existing logic
        const placed = await placeFilesInSteamConfigFromTemp(extractedPathInternal, false, forceAutoSaveFromLibrary);

        if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && placed) {
            return true;
        } else if ((autoPlaceFilesEnabled || forceAutoSaveFromLibrary) && !placed) {
            const reason = forceAutoSaveFromLibrary ? "(forced for library update)" : "(toggle)";
            sendStatus(`Auto-Save active ${reason} (S6) but failed or no files were found to place. Saving archive instead.`, 'warning');
        }

        // Create user zip
        const finalZip = new AdmZip();
        finalZip.addLocalFolder(extractedPathInternal, '');
        const steamPathToSave = effectiveSteamDownloadsPath;
        if (!fs.existsSync(steamPathToSave)) await fsPromises.mkdir(steamPathToSave, { recursive: true });

        const finalZipPathUser = path.join(steamPathToSave, `${sanitizeFilename(effectiveGameNameToUse)} - ${steamIdToDownload} (Premium).zip`);
        finalZip.writeZip(finalZipPathUser);
        sendStatus(`Saved to: ${finalZipPathUser}`, 'success');
        return true;

    } catch (error) {
        console.warn(`Application Error: Download/processing failed (S6) for AppID ${steamIdToDownload}.`);
        if (error instanceof got.HTTPError && error.response && error.response.statusCode === 404) {
            sendStatus(`Game data not found (S6) for AppID ${steamIdToDownload}`, 'error');
        } else {
            sendStatus(`Download/processing failed (S6) for AppID ${steamIdToDownload}.`, 'error');
        }
        return false;
    } finally {
        if (fs.existsSync(initialDownloadZipPathInternal)) try { await fsPromises.unlink(initialDownloadZipPathInternal); } catch (_) { }
        if (fs.existsSync(extractedPathInternal)) try { await fsPromises.rm(extractedPathInternal, { recursive: true, force: true }); } catch (_) { }
    }
}

async function scrapeDlcAppIds(mainAppId) {
    const isDlcViewActive = mainWindow?.webContents.getURL().includes('dlcView'); // URL part is fine
    const currentStatusSender = isDlcViewActive ? sendDlcStatus : sendStatus;
    const apiUrlInternal = `${STEAM_API_BASE_INTERNAL.appdetails}?appids=${mainAppId}&cc=us&l=en`; // Internal, not logged
    let dlcAppIds = [];
    let attemptHtmlScrape = true;
    let apiExplicitlySaidInvalidOrNoData = false;
    try {
        const response = await got(apiUrlInternal, {
            timeout: { request: 20000 },
            responseType: 'json',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        if (response.body && response.body[mainAppId]) {
            const appDataContainer = response.body[mainAppId];
            if (appDataContainer.success && appDataContainer.data) {
                const appData = appDataContainer.data;
                if (appData.dlc && Array.isArray(appData.dlc) && appData.dlc.length > 0) {
                    dlcAppIds = appData.dlc.map(String);
                    attemptHtmlScrape = false;
                } else {
                    attemptHtmlScrape = true;
                }
            } else if (appDataContainer.success === false) {
                currentStatusSender(`AppID ${mainAppId} appears invalid or has no data via API. No further DLC check needed.`, 'info');
                attemptHtmlScrape = false;
                apiExplicitlySaidInvalidOrNoData = true;
            } else {
                currentStatusSender(`API call for ${mainAppId} returned unexpected data structure.`, 'warning');
                attemptHtmlScrape = true;
            }
        } else {
            currentStatusSender(`API call for ${mainAppId} failed to provide data.`, 'warning'); // Generic
            attemptHtmlScrape = true;
        }
    } catch (error) {
        console.warn(`Network Error during API DLC fetch for ${mainAppId}.`); // Generic
        currentStatusSender(`API DLC fetch for ${mainAppId} failed.`, 'warning'); // Generic
        attemptHtmlScrape = true;
    }
    if (attemptHtmlScrape) {
        const targetUrlInternal = `https://store.steampowered.com/dlc/${mainAppId}/`; // Internal, not logged
        const allOriginsUrlInternal = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrlInternal)}`; // Internal, not logged
        try {
            const htmlResponse = await got(allOriginsUrlInternal, { timeout: { request: 25000 }, responseType: 'json' });
            if (htmlResponse.body?.contents) {
                const $ = cheerio.load(htmlResponse.body.contents);
                const foundDlcLinks = new Set();
                $('div.dlc_row a.dlc_row_title, a.game_area_dlc_row, #RecommendationsRows a.recommendation_link').each((i, elem) => {
                    const href = $(elem).attr('href'); // href is a relative or absolute store path, parts are standard
                    if (href) {
                        const match = href.match(/\/app\/(\d+)/);
                        if (match?.[1]) foundDlcLinks.add(match[1]);
                    }
                });
                if (foundDlcLinks.size > 0) {
                    const htmlDlcIds = Array.from(foundDlcLinks);
                    dlcAppIds = [...new Set([...dlcAppIds, ...htmlDlcIds])];
                    currentStatusSender(`Found ${htmlDlcIds.length} additional content link(s) for ${mainAppId}`, 'info');
                } else {
                    currentStatusSender(`${mainAppId} did not find any additional content links.`, 'info');
                }
            } else {
                currentStatusSender(`Failed to get valid content from DLC proxy for AppID ${mainAppId}.`, 'error'); // Generic
            }
        } catch (proxyError) {
             console.warn(`Network Error: Problem fetching from DLC proxy for AppID ${mainAppId}.`); // Generic
             currentStatusSender(`Failed to get DLCs via proxy for AppID ${mainAppId}.`, 'error'); // Generic
        }
    }
    const finalDlcAppIds = [...new Set(dlcAppIds.map(String))];
    if (finalDlcAppIds.length > 0) {
        currentStatusSender(`Found ${finalDlcAppIds.length} official additional content AppID(s) for ${mainAppId}.`, 'success');
    } else {
        if (!isDlcViewActive && !apiExplicitlySaidInvalidOrNoData) {
            currentStatusSender(`No official additional content found for AppID ${mainAppId}.`, 'info');
        }
    }
    return finalDlcAppIds;
}
async function appendDlcToSteamtoolsLua(dlcAppIds) {
    if (!dlcAppIds || dlcAppIds.length === 0) {
        sendStatus('No DLC AppIDs to append.', 'info');
        return false;
    }
    const steamConfigPathInternal = getSteamConfigPath(); // Internal
    if (!steamConfigPathInternal) {
    sendDlcStatus('Cannot manage DLC - Game platform config path not determined.', 'error');
    return false;
}
    const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in');
    const steamtoolsLuaPathInternal = path.join(stplugInDirInternal, STEAMTOOLS_LUA_FILENAME_INTERNAL); // Filename okay
    try {
        await fsPromises.mkdir(stplugInDirInternal, { recursive: true });
        let currentContent = '';
        if (fs.existsSync(steamtoolsLuaPathInternal)) {
            currentContent = await fsPromises.readFile(steamtoolsLuaPathInternal, 'utf8');
        }
        let newDlcAddedCount = 0;
        let contentToAppendAccumulatively = '';
        dlcAppIds.forEach(id => {
            const dlcEntryRegex = new RegExp(`addappid\\(\\s*${id}\\s*,\\s*1\\s*\\)`);
            if (!dlcEntryRegex.test(currentContent) && !dlcEntryRegex.test(contentToAppendAccumulatively)) {
                contentToAppendAccumulatively += `addappid(${id}, 1)\n`; // This content is fine
                newDlcAddedCount++;
            }
        });
        if (contentToAppendAccumulatively.trim()) {
            const prefixNewline = (currentContent.trim() !== '' && !currentContent.endsWith('\n')) ? '\n' : '';
            await fsPromises.appendFile(steamtoolsLuaPathInternal, prefixNewline + contentToAppendAccumulatively);
            sendStatus(`${newDlcAddedCount} new additional content item(s) added.`, 'success');
            return true;
        } else {
            sendStatus(`All ${dlcAppIds.length} provided additional content item(s) already exist or were duplicates. No changes made.`, 'info');
            return false;
        }
    } catch (error) {
        console.warn("File System Error: Problem appending DLCs."); // Generic
        sendStatus(`Error appending DLCs: A file operation failed.`, 'error');
        return false;
    }
}

async function addSingleDlcToSteamtoolsLua(dlcAppId) {
    if (!dlcAppId || !/^\d+$/.test(String(dlcAppId))) {
        sendDlcStatus(`Invalid DLC AppID for addition: ${dlcAppId}`, 'error');
        return false;
    }
    const steamConfigPathInternal = getSteamConfigPath(); // Internal
    if (!steamConfigPathInternal) {
        sendDlcStatus('Cannot add DLC - Game platform config path not determined.', 'warning');
        return false;
    }
    const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in');
    const steamtoolsLuaPathInternal = path.join(stplugInDirInternal, STEAMTOOLS_LUA_FILENAME_INTERNAL); // Filename okay
    try {
        await fsPromises.mkdir(stplugInDirInternal, { recursive: true });
        let currentContent = '';
        if (fs.existsSync(steamtoolsLuaPathInternal)) {
            currentContent = await fsPromises.readFile(steamtoolsLuaPathInternal, 'utf8');
            const dlcEntryRegex = new RegExp(`addappid\\(\\s*${dlcAppId}\\s*,\\s*1\\s*\\)`);
            if (dlcEntryRegex.test(currentContent)) {
                return true;
            }
        }
        const prefixNewline = (currentContent.trim() !== '' && !currentContent.endsWith('\n')) ? '\n' : '';
        const contentToAppend = `addappid(${dlcAppId}, 1)\n`; // Content fine
        await fsPromises.appendFile(steamtoolsLuaPathInternal, prefixNewline + contentToAppend);
        return true;
    } catch (error) {
        console.warn(`File System Error: Problem adding DLC AppID ${dlcAppId}.`); // Generic
        sendDlcStatus(`Error managing DLC entry: A file system error occurred.`, 'error');
        return false;
    }
}

async function removeDlcEntryFromSteamtoolsLua(dlcAppIdToRemove) {
    if (!dlcAppIdToRemove || !/^\d+$/.test(String(dlcAppIdToRemove))) {
        sendDlcStatus(`Invalid DLC AppID for removal: ${dlcAppIdToRemove}`, 'error');
        return false;
    }
    const steamConfigPathInternal = getSteamConfigPath(); // Internal
    if (!steamConfigPathInternal) {
        sendDlcStatus('Cannot remove DLC - Game platform config path not determined.', 'warning');
        return false;
    }
    const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in');
    const steamtoolsLuaPathInternal = path.join(stplugInDirInternal, STEAMTOOLS_LUA_FILENAME_INTERNAL); // Filename okay
    if (!fs.existsSync(steamtoolsLuaPathInternal)) {
    sendDlcStatus(`Configuration file not found. Nothing to remove for AppID ${dlcAppIdToRemove}.`, 'info');
    return false;
}
    try {
        let content = await fsPromises.readFile(steamtoolsLuaPathInternal, 'utf8');
        const dlcEntryRegex = new RegExp(`^\\s*addappid\\(\\s*${dlcAppIdToRemove}\\s*,\\s*1\\s*\\)\\s*[\r\n]*`, 'gm');
        const originalLength = content.length;
        content = content.replace(dlcEntryRegex, '');
        if (content.length === originalLength) {
            return false;
        }
        await fsPromises.writeFile(steamtoolsLuaPathInternal, content.trim() === '' ? '' : content);
        return true;
    } catch (error) {
        console.warn(`File System Error: Problem removing DLC AppID ${dlcAppIdToRemove}.`); // Generic
        sendDlcStatus(`Error managing DLC entry: A file system error occurred.`, 'error');
        return false;
    }
}

function getSteamConfigPath() { // Internal path, not logged by this function
    let actualSteamRoot;
    if (process.platform === 'darwin') actualSteamRoot = path.join(os.homedir(), 'Library', 'Application Support', 'Steam'); // Standard OSX path
    else actualSteamRoot = detectedSteamPath;
    if (!actualSteamRoot || !fs.existsSync(actualSteamRoot)) return null;
    return path.join(actualSteamRoot, 'config');
}

// Returns every "steamapps" directory across all Steam library folders on this PC.
// Uses the detected Steam root plus any extra libraries listed in libraryfolders.vdf.
function findAllSteamappsDirs() {
    const dirs = new Set();
    let root = null;
    if (process.platform === 'darwin') root = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
    else root = detectedSteamPath;
    if (!root || !fs.existsSync(root)) return [];

    const mainSteamapps = path.join(root, 'steamapps');
    if (fs.existsSync(mainSteamapps)) dirs.add(mainSteamapps);

    // libraryfolders.vdf lists every library path (including those on other drives).
    const vdfCandidates = [
        path.join(mainSteamapps, 'libraryfolders.vdf'),
        path.join(root, 'config', 'libraryfolders.vdf')
    ];
    for (const vdfPath of vdfCandidates) {
        try {
            if (!fs.existsSync(vdfPath)) continue;
            const content = fs.readFileSync(vdfPath, 'utf8');
            const re = /"path"\s*"([^"]+)"/gi;
            let m;
            while ((m = re.exec(content)) !== null) {
                // VDF stores Windows paths with escaped backslashes ("H:\\Program Files...").
                const libPath = m[1].replace(/\\\\/g, '\\');
                const sa = path.join(libPath, 'steamapps');
                if (fs.existsSync(sa)) dirs.add(sa);
            }
        } catch (e) { /* silent fail – fall back to whatever we already found */ }
    }
    return Array.from(dirs);
}

// Locates appmanifest_<appid>.acf in any of the PC's steamapps libraries.
function findAppManifestFile(appId) {
    for (const dir of findAllSteamappsDirs()) {
        const f = path.join(dir, `appmanifest_${appId}.acf`);
        if (fs.existsSync(f)) return f;
    }
    return null;
}

function readSteamAppManifestSummary(manifestPath, appId) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const readValue = (key) => {
        const match = new RegExp(`"${key}"\\s+"([^"]*)"`, 'i').exec(content);
        return match ? match[1].replace(/\\\\/g, '\\') : '';
    };
    const steamappsDir = path.dirname(manifestPath);
    const installDir = readValue('installdir');
    return {
        appId: String(appId),
        name: readValue('name') || `AppID: ${appId}`,
        installDir,
        steamappsDir,
        gameDir: installDir ? path.join(steamappsDir, 'common', installDir) : ''
    };
}

function getSteamGameInstall(appId) {
    const manifestPath = findAppManifestFile(appId);
    if (!manifestPath) return null;
    const summary = readSteamAppManifestSummary(manifestPath, appId);
    if (!summary.gameDir || !fs.existsSync(summary.gameDir)) return null;
    return summary;
}

function sanitizeShortcutName(value) {
    return String(value || 'Steam Game').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().slice(0, 110) || 'Steam Game';
}

function getSteamlessShortcutPath(game) {
    const safeName = sanitizeShortcutName(game.name || `AppID ${game.appId || ''}`);
    return path.join(DESKTOP_PATH_INTERNAL, `${safeName}.lnk`);
}

const STEAMLESS_DLL_FILE_NAMES = ['steam_api64.dll', 'steam_api.dll'];

function getSteamlessDllResourceDir() {
    const candidates = [
        app.isPackaged ? path.join(process.resourcesPath, 'dll') : '',
        path.join(__dirname, 'dll'),
        'D:\\Downloads\\dll'
    ].filter(Boolean);
    return candidates.find(dir => {
        try { return fs.existsSync(dir) && fs.statSync(dir).isDirectory(); }
        catch (e) { return false; }
    }) || candidates[0];
}

function findFileRecursiveLimited(startDir, targetName) {
    const targetLower = targetName.toLowerCase();
    const maxDepth = 8;
    const maxDirs = 5000;
    let scannedDirs = 0;

    function walk(currentDir, depth) {
        if (depth > maxDepth || scannedDirs > maxDirs) return null;
        scannedDirs += 1;
        let entries;
        try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (e) { return null; }

        for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase() === targetLower) return path.join(currentDir, entry.name);
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (/^(steamapps|workshop|shadercache|screenshots|_commonredist|redist|support|extras|docs)$/i.test(entry.name)) continue;
            const found = walk(path.join(currentDir, entry.name), depth + 1);
            if (found) return found;
        }
        return null;
    }

    return walk(startDir, 0);
}

function getSteamlessDllCandidate(gameDir) {
    if (!gameDir || !fs.existsSync(gameDir)) return null;

    for (const fileName of STEAMLESS_DLL_FILE_NAMES) {
        const targetPath = findFileRecursiveLimited(gameDir, fileName);
        if (targetPath) return { fileName, targetPath, backupPath: `${targetPath}.bak` };
    }

    for (const fileName of STEAMLESS_DLL_FILE_NAMES) {
        const backupPath = findFileRecursiveLimited(gameDir, `${fileName}.bak`);
        if (backupPath) return { fileName, targetPath: backupPath.slice(0, -4), backupPath };
    }

    return null;
}

function getSteamlessDllState(install) {
    const candidate = install ? getSteamlessDllCandidate(install.gameDir) : null;
    if (!candidate) return { found: false, enabled: false, fileName: '' };
    return {
        found: true,
        enabled: fs.existsSync(candidate.backupPath),
        fileName: candidate.fileName
    };
}

async function setSteamlessDllStateForInstall(install, enable) {
    const candidate = getSteamlessDllCandidate(install.gameDir);
    if (!candidate) {
        await removeSteamlessShortcut(install);
        return {
            success: true,
            found: false,
            enabled: false,
            message: 'Sorry, this game cannot be patched.'
        };
    }

    const sourcePath = path.join(getSteamlessDllResourceDir(), candidate.fileName);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Bundled ${candidate.fileName} was not found.`);
    }

    if (enable) {
        let movedOriginal = false;
        try {
            if (fs.existsSync(candidate.targetPath) && !fs.existsSync(candidate.backupPath)) {
                await fsPromises.rename(candidate.targetPath, candidate.backupPath);
                movedOriginal = true;
            }
            await fsPromises.copyFile(sourcePath, candidate.targetPath);
            await createSteamlessExeShortcut(install);
            return {
                success: true,
                found: true,
                enabled: true,
                message: 'Patch enabled.'
            };
        } catch (e) {
            await removeSteamlessShortcut(install);
            if (movedOriginal && fs.existsSync(candidate.backupPath)) {
                try {
                    if (fs.existsSync(candidate.targetPath)) await fsPromises.rm(candidate.targetPath, { force: true });
                    await fsPromises.rename(candidate.backupPath, candidate.targetPath);
                } catch (_) {}
            }
            throw e;
        }
    }

    await removeSteamlessShortcut(install);

    if (!fs.existsSync(candidate.backupPath)) {
        return {
            success: true,
            found: true,
            enabled: false,
            message: 'Patch disabled.'
        };
    }

    if (fs.existsSync(candidate.targetPath)) {
        await fsPromises.rm(candidate.targetPath, { force: true });
    }
    await fsPromises.rename(candidate.backupPath, candidate.targetPath);
    return {
        success: true,
        found: true,
        enabled: false,
        message: 'Patch disabled.'
    };
}

function normalizeNameForScore(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

let appInfoTextCache = null;
function getAppInfoReadableText() {
    if (appInfoTextCache !== null) return appInfoTextCache;
    appInfoTextCache = '';
    try {
        const appInfoPath = detectedSteamPath ? path.join(detectedSteamPath, 'appcache', 'appinfo.vdf') : '';
        if (appInfoPath && fs.existsSync(appInfoPath)) {
            appInfoTextCache = fs.readFileSync(appInfoPath).toString('latin1');
        }
    } catch (e) {
        appInfoTextCache = '';
    }
    return appInfoTextCache;
}

function getAppInfoExeBoost(gameDir, exePath) {
    const appInfoText = getAppInfoReadableText();
    if (!appInfoText) return 0;

    const rel = path.relative(gameDir, exePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return 0;

    const slashRel = rel.replace(/\\/g, '/');
    const backslashRel = rel.replace(/\//g, '\\');
    const escapedBackslashRel = backslashRel.replace(/\\/g, '\\\\');
    if (appInfoText.includes(slashRel) || appInfoText.includes(backslashRel) || appInfoText.includes(escapedBackslashRel)) {
        return 220;
    }

    return 0;
}

function findPreferredGameExe(gameDir, gameName) {
    const candidates = [];
    const badNameRe = /(unins|uninstall|crash|unitycrashhandler|setup|install|redist|vcredist|dxsetup|dotnet|helper|service|eac|easyanticheat|benchmark)/i;
    const rootName = normalizeNameForScore(path.basename(gameDir));
    const gameNameNorm = normalizeNameForScore(gameName);

    function walk(currentDir, depth) {
        if (depth > 8 || candidates.length > 600) return;
        let entries;
        try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (e) { return; }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (/^(redist|_commonredist|support|extras|tools|manual|docs)$/i.test(entry.name)) continue;
                walk(fullPath, depth + 1);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
                const base = path.basename(entry.name, '.exe');
                const baseNorm = normalizeNameForScore(base);
                const rel = path.relative(gameDir, fullPath);
                const depthScore = rel.split(path.sep).length === 1 ? 60 : 20 - (depth * 3);
                let score = depthScore;
                const relForScore = rel.replace(/\\/g, '/');
                if (/\/Binaries\/Win64\/[^/]+-Win64-Shipping\.exe$/i.test(`/${relForScore}`)) score += 260;
                else if (/\/Binaries\/Win64\/[^/]+\.exe$/i.test(`/${relForScore}`)) score += 170;
                else if (/\/Binaries\/Win32\/[^/]+\.exe$/i.test(`/${relForScore}`)) score += 120;
                else if (/shipping/i.test(relForScore)) score += 90;
                score += getAppInfoExeBoost(gameDir, fullPath);
                if (baseNorm && (baseNorm === rootName || baseNorm === gameNameNorm)) score += 60;
                if (rootName && baseNorm.includes(rootName)) score += 25;
                if (gameNameNorm && baseNorm.includes(gameNameNorm.slice(0, Math.min(12, gameNameNorm.length)))) score += 20;
                if (/win64|x64|shipping/i.test(rel)) score += 8;
                if (badNameRe.test(entry.name) || badNameRe.test(rel)) score -= 120;
                candidates.push({ path: fullPath, score });
            }
        }
    }

    walk(gameDir, 0);
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].path : null;
}

function runPowerShell(command) {
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                error.message = stderr || error.message;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function psQuote(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

async function createDesktopShortcut(shortcutPath, targetPath, workingDirectory, description) {
    const script = [
        '$shell = New-Object -ComObject WScript.Shell',
        `$shortcut = $shell.CreateShortcut(${psQuote(shortcutPath)})`,
        `$shortcut.TargetPath = ${psQuote(targetPath)}`,
        `$shortcut.WorkingDirectory = ${psQuote(workingDirectory)}`,
        `$shortcut.Description = ${psQuote(description)}`,
        '$shortcut.Save()'
    ].join('; ');
    await runPowerShell(script);
}

async function createSteamlessExeShortcut(install) {
    const shortcutPath = getSteamlessShortcutPath(install);
    const exePath = findPreferredGameExe(install.gameDir, install.name);
    if (!exePath) throw new Error('No game executable was found in the installed game folder.');
    await createDesktopShortcut(shortcutPath, exePath, path.dirname(exePath), `GameZoneQA shortcut for AppID ${install.appId}`);
    return 'desktop shortcut created';
}

function launchSteamlessGame(install) {
    const exePath = findPreferredGameExe(install.gameDir, install.name);
    if (!exePath) throw new Error('No game executable was found in the installed game folder.');
    const child = spawn(exePath, [], { detached: true, cwd: path.dirname(exePath), stdio: 'ignore' });
    child.unref();
}

async function removeSteamlessShortcut(install) {
    const shortcutPath = getSteamlessShortcutPath(install);
    if (shortcutPath && fs.existsSync(shortcutPath)) {
        await fsPromises.rm(shortcutPath, { force: true });
    }
}

// Sets (readOnly=true) or clears (readOnly=false) the read-only attribute on the
// appmanifest for the given appId. On Windows, chmod 0o444/0o666 toggles the
// read-only attribute, which works without admin for files the user can write.
function setAppManifestReadOnly(appId, readOnly) {
    const file = findAppManifestFile(appId);
    if (!file) return { found: false, success: false };
    try {
        fs.chmodSync(file, readOnly ? 0o444 : 0o666);
        return { found: true, success: true, file };
    } catch (e) {
        return { found: true, success: false, error: e.message };
    }
}

// ---------------- Auto-updater ----------------
const UPDATER_EXE_NAME = 'GameZoneQAUpdater.exe';
const TARGET_EXE_NAME = 'GameZoneQA Ultimate.exe';
const UPDATER_TARGET_FILE_NAME = 'GameZoneQAUpdater.target';

function getUpdateTargetExe() {
    return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function sweepOldExes() {
    const exeDir = path.dirname(getUpdateTargetExe());
    try {
        for (const entry of fs.readdirSync(exeDir)) {
            if (/\.old(\.\d+)?\.exe$/i.test(entry)) {
                try { fs.unlinkSync(path.join(exeDir, entry)); } catch {}
            }
        }
    } catch {}
}

function findUpdaterExe() {
    const targetDir = path.dirname(getUpdateTargetExe());
    const candidates = [
        path.join(targetDir, UPDATER_EXE_NAME),
        path.join(__dirname, 'GameZoneQAUpdater', 'GameZoneQAUpdater', 'bin', 'Release', UPDATER_EXE_NAME),
        path.join(__dirname, 'GameZoneQAUpdater', 'GameZoneQAUpdater', 'bin', 'Debug', UPDATER_EXE_NAME),
        path.join(__dirname, UPDATER_EXE_NAME)
    ];

    for (const candidate of candidates) {
        try { if (fs.existsSync(candidate)) return candidate; } catch {}
    }
    return null;
}

async function launchUpdater(updaterExe) {
    try {
        fs.writeFileSync(
            path.join(path.dirname(updaterExe), UPDATER_TARGET_FILE_NAME),
            path.basename(getUpdateTargetExe()),
            'utf8'
        );
    } catch (e) {
        console.warn('File System Warning: Could not write updater target file.');
    }

    const errMsg = await shell.openPath(updaterExe);
    if (errMsg) throw new Error(errMsg);
}

function showUpdateRequiredModal(remoteVersion, localVersion) {
    return new Promise((resolve) => {
        const esc = (s) => String(s).replace(/[<>&"']/g, (c) =>
            ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-user-select: none; user-select: none; }
html, body { height: 100%; background: transparent; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #d4d4d4; }
body { -webkit-app-region: drag; }
.card {
    height: 100%;
    background: #0a0a0a;
    border: 1px solid #1f1f1f;
    border-radius: 10px;
    padding: 26px 28px 22px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0,0,0,0.7);
}
.badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ef4444;
    padding: 3px 8px;
    border: 1px solid rgba(239,68,68,0.35);
    border-radius: 4px;
    margin-bottom: 14px;
    align-self: flex-start;
}
.title { color: #e6e6e6; font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.subtitle { color: #909090; font-size: 12px; line-height: 1.5; margin-bottom: 20px; }
.versions {
    background: #141414;
    border: 1px solid #1a1a1a;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.row .lbl { color: #5e5e5e; }
.row .val { color: #d4d4d4; font-family: Consolas, monospace; font-weight: 500; }
.row .val.new { color: #ef4444; }
.buttons { display: flex; gap: 8px; margin-top: auto; -webkit-app-region: no-drag; }
button {
    flex: 1;
    height: 38px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.cancel { background: transparent; color: #909090; border: 1px solid #1f1f1f; }
.cancel:hover { background: #141414; color: #d4d4d4; border-color: #2a2a2a; }
.update { background: #ef4444; color: #0a0a0a; border: 1px solid #ef4444; }
.update:hover { background: #f15b5b; }
</style></head><body><div class="card">
<div class="badge">Update Required</div>
<div class="title">A new version of GameZoneQA Ultimate is available</div>
<div class="subtitle">You must update to continue. The updater will close GameZoneQA Ultimate, replace this build, then relaunch automatically.</div>
<div class="versions">
    <div class="row"><span class="lbl">Current version</span><span class="val">v${esc(localVersion)}</span></div>
    <div class="row"><span class="lbl">Available version</span><span class="val new">v${esc(remoteVersion)}</span></div>
</div>
<div class="buttons">
    <button class="cancel" onclick="console.log('GZQA_CANCEL')">Cancel</button>
    <button class="update" onclick="console.log('GZQA_UPDATE')">Update</button>
</div>
</div></body></html>`;

        const win = new BrowserWindow({
            width: 440,
            height: 320,
            resizable: false,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            skipTaskbar: false,
            center: true,
            icon: path.join(__dirname, 'renderer', 'udp.ico'),
            title: 'GameZoneQA Ultimate',
            webPreferences: { contextIsolation: true, nodeIntegration: false, devTools: false, sandbox: true }
        });
        win.setMenuBarVisibility(false);

        let decided = false;
        const decide = (choice) => {
            if (decided) return;
            decided = true;
            resolve(choice);
            try { win.close(); } catch {}
        };

        win.webContents.on('console-message', (_event, _level, message) => {
            if (message === 'GZQA_UPDATE') decide('update');
            else if (message === 'GZQA_CANCEL') decide('cancel');
        });
        win.on('closed', () => decide('cancel'));

        win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    });
}

async function performVersionCheck() {
    return true; // TEMP: update check bypassed (updater build fails with ffmpeg.dll error)
    sweepOldExes();

    let remoteVersion;
    try {
        const response = await got(VERSION_URL_INTERNAL, { timeout: { request: 10000 } });
        remoteVersion = (response.body || '').replace(/^\uFEFF/, '').trim();
    } catch (e) {
        console.warn('Network Error: Update check failed.');
        return true;
    }

    if (!remoteVersion || remoteVersion === APP_VERSION) {
        return true;
    }

    if (mainWindow) mainWindow.webContents.send('version-mismatch');
    const choice = await showUpdateRequiredModal(remoteVersion, APP_VERSION);

    if (choice === 'update') {
        const updaterExe = findUpdaterExe();
        if (!updaterExe) {
            showThemedMessage(
                'Update failed',
                `${UPDATER_EXE_NAME} not found.\n\nPlace ${UPDATER_EXE_NAME} next to ${TARGET_EXE_NAME} and try again.`
            );
        } else {
            try {
                await launchUpdater(updaterExe);
            } catch (e) {
                showThemedMessage(
                    'Update failed',
                    'Could not launch the updater.\n\n' + (e && e.message ? e.message : e)
                );
            }
        }
    }

    setTimeout(() => app.exit(0), 300);
    return false;
}

// --- Electron App Lifecycle & Window Management ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 660,
        minWidth: 760,
        minHeight: 540,
        resizable: true,
        icon: path.join(__dirname, 'renderer', 'udp.ico'),
        frame: false, 
        webPreferences: {
            preload: path.join(__dirname, 'preload-loader.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webviewTag: false,
            plugins: true, // enables Chromium's built-in PDF viewer (Help instructions)
            devTools: false // true for dev, false for prod
        }
    });
    if (process.platform !== 'darwin') mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html')); // HTML path fine
    const resizeFullscreenWatchZonePlayer = () => {
        if (!watchZonePlayerFullscreen || !watchZonePlayerView || !mainWindow || mainWindow.isDestroyed()) return;
        const [width, height] = mainWindow.getContentSize();
        watchZonePlayerView.setBounds({ x: 0, y: 0, width, height });
    };
    mainWindow.on('resize', resizeFullscreenWatchZonePlayer);
    mainWindow.on('enter-full-screen', resizeFullscreenWatchZonePlayer);
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER CONSOLE] (${level}) ${message} -- ${sourceId}:${line}`);
    });
    mainWindow.webContents.on('did-finish-load', async () => {
        try { if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true }); }
        catch (err) {
             console.warn("File System Error: Problem setting up user data folder."); // Generic
             sendStatus(`Error setting up user data folder. Please check application permissions.`, 'error');
             showThemedMessage("User Data Error", `Failed to initialize user data directory. Please check application permissions.`);
        }

        detectedSteamPath = await findSteamPath();
        updateConfigFilePaths();

        await loadAndSetDownloadsPath();
        await loadAutoPlaceToggleState();
        await loadDlcToggleState();
        await loadInitialUnlockGameState();
        await performAuthentication(false);
    });
    mainWindow.on('closed', () => { mainWindow = null; youtubeMusicBrowserView = null; youtubeMusicBrowserViewAttached = false; });
}
app.whenReady().then(async () => {
    // DevTools block + window-open guards installed first so they cover the
    // update modal's BrowserWindow too.
    app.on('web-contents-created', (event, contents) => {
        contents.on('devtools-opened', () => {
            console.log('Security: DevTools blocked.');
            contents.closeDevTools(); // Instantly close it
        });

        // Prevent middle-click/new window injections
        contents.setWindowOpenHandler(() => {
            return { action: 'deny' };
        });
    });

    const upToDate = await performVersionCheck();
    if (!upToDate) return;

    createWindow();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- IPC Handlers ---
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.on('close-app', () => {
    console.log('Received close-app message in main.js, calling app.quit()'); // Add this
    app.quit();
});
ipcMain.on('minimize-app', () => {
    if (mainWindow) mainWindow.minimize();
});
ipcMain.on('maximize-app', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.on('submit-auth-code', async (event, code) => {
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        fs.writeFileSync(AUTH_FILE_PATH_INTERNAL, code.trim()); // Path not logged
        await performAuthentication(true);
    } catch (writeError) {
        console.warn("File System Error: Problem writing auth code."); // Generic
        if (mainWindow) mainWindow.webContents.send('auth-result', { success: false, message: `Error saving authentication information.`, readmeText: await getReadmeText(), isPremium: false, expirationInfo: null });
    }
});

ipcMain.handle('online-fix-open-folder', async (event, appId) => {
    if (!isUserPremium) return { success: false, pathOpened: false, message: 'Premium feature only.' };
    const pathsData = await readOnlinePathsFile();
    const gamePath = pathsData[appId]?.rootPath;

    if (gamePath && fs.existsSync(gamePath)) {
        shell.openPath(gamePath).catch(err => {
            sendStatus(`Online-Fix: Error opening folder for AppID ${appId}.`, 'error');
        });
        return { success: true, pathOpened: true };
    }
    // If path doesn't exist or is invalid, we indicate that the path needs to be set.
    return { success: false, pathOpened: false, message: `Path for AppID ${appId} not set.` };
});

ipcMain.handle('online-fix-set-path', async (event, appId) => {
    if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
    if (!mainWindow) return { success: false, message: 'Window not available.' };
    const result = await dialog.showOpenDialog(mainWindow, {
        title: `Select Game Folder for AppID ${appId}`,
        properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths?.[0]) {
        sendStatus(`Online-Fix: Game folder selection cancelled for AppID ${appId}.`, 'info');
        return { success: false, message: 'Cancelled.' };
    }
    const selectedPath = result.filePaths[0];
    const pathsData = await readOnlinePathsFile();
    if (!pathsData[appId]) {
        pathsData[appId] = {};
    }
    pathsData[appId].rootPath = selectedPath;
    await writeOnlinePathsFile(pathsData);
    sendStatus(`Online-Fix: Game folder for AppID ${appId} set successfully.`, 'success');
    return { success: true, path: selectedPath };
});


ipcMain.handle('online-fix-apply', async (event, appId) => {
    if (!isAuthenticated || !isUserPremium) {
        forceLogoutTamperDetected();
        return { success: false, message: 'Unauthorized' };
    }
    sendStatus(`Online-Fix Apply: Starting process for AppID ${appId}...`, 'info');
    const pathsData = await readOnlinePathsFile();

    let gameRootPath = getSteamGameInstall(appId)?.gameDir;
    if ((!gameRootPath || !fs.existsSync(gameRootPath)) && pathsData[appId]?.rootPath) {
        gameRootPath = pathsData[appId].rootPath;
    }

    if (!gameRootPath || !fs.existsSync(gameRootPath)) {
        sendStatus(`Online-Fix Apply: FAILED. Could not locate the installed game folder for AppID ${appId}.`, 'error');
        return { success: false, message: 'Installed game folder not found.' };
    }

    if (!pathsData[appId]) pathsData[appId] = {};
    pathsData[appId].rootPath = gameRootPath;
    
    const tempZipPath = path.join(os.tmpdir(), `online-fix-${appId}-${Date.now()}.zip`);
    try {
        const apiUrl = `https://api.github.com/repos/${REPO_REYAFIRA_INTERNAL}/contents/${appId}.zip?ref=main`;
        sendStatus(`Online-Fix Apply: Contacting download server...`, 'progress');
        const apiResponse = await got(apiUrl, { responseType: 'json', timeout: { request: 15000 } });
        const downloadUrl = apiResponse.body.download_url;

        if (!downloadUrl) throw new Error('Download URL not found in API response.');

        const downloadStream = got.stream(downloadUrl);
        downloadStream.on('downloadProgress', p => sendStatus(`Online-Fix Apply: Downloading... ${(p.percent * 100).toFixed(0)}%`, 'progress'));
        await pipeline(downloadStream, fs.createWriteStream(tempZipPath));

        sendStatus(`Online-Fix Apply: Download complete. Applying fix...`, 'progress');
        const zip = new AdmZip(tempZipPath);
        const zipEntries = zip.getEntries();
        const managedFiles = [];

        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            
            const destinationPath = path.join(gameRootPath, entry.entryName);
            const destinationDir = path.dirname(destinationPath);
            await fsPromises.mkdir(destinationDir, { recursive: true });

            let backupPath = null;
            if (fs.existsSync(destinationPath)) {
                backupPath = `${destinationPath}.bak`;
                await fsPromises.rename(destinationPath, backupPath);
            }
            
            zip.extractEntryTo(entry, destinationDir, false, true);
            
            managedFiles.push({
                path: entry.entryName, // Relative path
                backedUpOriginal: backupPath ? path.relative(gameRootPath, backupPath) : null
            });
        }
        
        pathsData[appId].managedFiles = managedFiles;
        await writeOnlinePathsFile(pathsData);
        
        sendStatus(`Online-Fix Apply: Successfully applied fix`, 'success');
        return { success: true };
    } catch (error) {
        console.error(`Online-Fix Apply Error for ${appId}:`, error);
        let message = 'An unexpected error occurred.';
        if (error.response?.statusCode === 404) message = 'No online fix found for this game.';
        else if (error instanceof got.TimeoutError) message = 'Download server timed out.';
        else if (error.code === 'ENOENT') message = 'A file operation failed. Check permissions.';
        sendStatus(`Online-Fix Apply: FAILED. Reason: ${message}`, 'error');
        return { success: false, message };
    } finally {
        if (fs.existsSync(tempZipPath)) {
            await fsPromises.unlink(tempZipPath);
        }
    }
});

ipcMain.handle('online-fix-remove', async (event, appId) => {
    if (!isAuthenticated || !isUserPremium) {
        forceLogoutTamperDetected();
        return { success: false, message: 'Unauthorized' };
    }
    sendStatus(`Online-Fix Remove: Starting removal for AppID ${appId}...`, 'info');
    const pathsData = await readOnlinePathsFile();
    const gameData = pathsData[appId];

    if (!gameData || !gameData.rootPath || !gameData.managedFiles || gameData.managedFiles.length === 0) {
        sendStatus(`Online-Fix Remove: No fix data found for AppID ${appId}. Nothing to remove.`, 'warning');
        return { success: false, message: 'No fix applied.' };
    }

    try {
        // Iterate backwards to handle nested files correctly
        for (let i = gameData.managedFiles.length - 1; i >= 0; i--) {
            const fileInfo = gameData.managedFiles[i];
            const installedPath = path.join(gameData.rootPath, fileInfo.path);

            if (fs.existsSync(installedPath)) {
                await fsPromises.unlink(installedPath);
            }

            if (fileInfo.backedUpOriginal) {
                const backupPath = path.join(gameData.rootPath, fileInfo.backedUpOriginal);
                const originalPath = backupPath.slice(0, -4); // Remove .bak
                if (fs.existsSync(backupPath)) {
                    await fsPromises.rename(backupPath, originalPath);
                }
            }
        }

        pathsData[appId].managedFiles = []; // Clear the list of managed files
        await writeOnlinePathsFile(pathsData);

        sendStatus(`Online-Fix Remove: Successfully removed fix for AppID ${appId}.`, 'success');
        return { success: true };
    } catch (error) {
        console.error(`Online-Fix Remove Error for ${appId}:`, error);
        sendStatus(`Online-Fix Remove: FAILED for AppID ${appId}. An error occurred.`, 'error');
        return { success: false, message: 'An error occurred during removal.' };
    }
});

ipcMain.on('user-logout', async (event) => {
    sendStatus('Logging out', 'info');
    isUserPremium = false;
    isAuthenticated = false;
    globalUserStatus = 'free';
    watchZoneClosePlayer();
    try {
        if (fs.existsSync(AUTH_FILE_PATH_INTERNAL)) { // Path not logged
            await fsPromises.unlink(AUTH_FILE_PATH_INTERNAL);
        }
    } catch (err) {
        console.warn("File System Error: Problem deleting authorization file during logout."); // Generic
        sendStatus(`Error during logout: Could not remove authorization data.`, 'error');
    }
    if (mainWindow) {
        mainWindow.webContents.send('auth-result', {
            success: false,
            message: 'Successfully logged out',
            readmeText: await getReadmeText(),
            isPremium: false,
            expirationInfo: null
        });
    }
});

ipcMain.handle('request-device-change', async (event, authCode) => {
    try {
        const localHwid = await getLocalHardwareId();
        const response = await got.post('http://209.46.127.241/api/auth/reset-device', {
            json: { code: authCode, hwid: localHwid },
            timeout: { request: 10000 },
            throwHttpErrors: false
        });

        try {
            const data = JSON.parse(response.body);
            return {
                success: data.success ?? false,
                message: data.message ?? data.error ?? 'Unknown error occurred.'
            };
        } catch (jsonErr) {
            return { success: false, message: 'Server error or unreachable.' };
        }
    } catch (e) {
        console.error("Device reset error:", e);
        return { success: false, message: 'Server error or unreachable.' };
    }
});


ipcMain.on('process-appid', async (event, steamIdInput, forceAutoSaveFromLibrary = false, forceSource6Only = false) => {
    if (!isAuthenticated) {
        forceLogoutTamperDetected();
        if (mainWindow) mainWindow.webContents.send('gamelist-item-process-complete', { appId: steamIdInput, success: false });
        return; // Kills the download!
    }
    currentSteamId = steamIdInput;
    currentGameName = null;
    const startTime = Date.now();
    let mainWorkflowSuccess = await mainWorkflow(currentSteamId, forceAutoSaveFromLibrary, forceSource6Only);

    if (mainWorkflowSuccess && isUserPremium && dlcModeEnabled) {
        const steamConfigAvailable = getSteamConfigPath(); // Path not logged
        const effectiveAutoPlaceForDlc = (autoPlaceFilesEnabled || forceAutoSaveFromLibrary);
        if (steamConfigAvailable && effectiveAutoPlaceForDlc) {
            const dlcAppIds = await scrapeDlcAppIds(steamIdInput);
            if (dlcAppIds.length > 0) await appendDlcToSteamtoolsLua(dlcAppIds);
        } else if (!steamConfigAvailable) {
            sendStatus('DLC Mode: Cannot proceed - Game platform config path not determined', 'error');
        } else if (steamConfigAvailable && !effectiveAutoPlaceForDlc) {
            sendStatus('DLC Mode: Auto-place for DLCs not active. DLCs will not be added automatically.', 'info');
        }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    sendStatus(`Process completed in ${duration}s.` , 'warning');

    if (mainWindow) {
        mainWindow.webContents.send('gamelist-item-process-complete', { appId: currentSteamId, success: mainWorkflowSuccess });
    }
    currentSteamId = null;
});

ipcMain.on('process-library-item-update', async (event, steamIdInput) => {
    // CORRECTED: This check now ONLY requires the user to be Premium.
    if (!isUserPremium) {
        sendStatus(`Library Update: This is a Premium feature.`, 'error');
        if (mainWindow) {
            mainWindow.webContents.send('library-item-update-complete', { appId: steamIdInput, success: false });
        }
        return;
    }

    sendStatus(`Library Update: Updating manifest IDs from ${steamIdInput}`, 'info');
    let success = false;

    try {
        const steamConfigDirInternal = getSteamConfigPath();
        if (!steamConfigDirInternal) {
            throw new Error('Game platform config path not detected.');
        }

        const stplugInDirInternal = path.join(steamConfigDirInternal, 'stplug-in');
        const luaFilePathInternal = path.join(stplugInDirInternal, `${steamIdInput}.lua`);

        if (!fs.existsSync(luaFilePathInternal)) {
            throw new Error(`File not found for AppID ${steamIdInput}.`);
        }

        const originalContent = await fsPromises.readFile(luaFilePathInternal, 'utf8');
        const lines = originalContent.split(/\r?\n/);
        // Filter out any line that starts with 'setManifestid' (ignoring leading whitespace)
        const newLines = lines.filter(line => !line.trim().startsWith('setManifestid'));
        const newContent = newLines.join('\n');

        if (originalContent.trim() === newContent.trim()) {
            sendStatus(`Library Update: No manifest IDs found to remove for AppID ${steamIdInput}. File is already clean.`, 'info');
            success = true;
        } else {
            await fsPromises.writeFile(luaFilePathInternal, newContent, 'utf8');
            sendStatus(`Library Update: Successfully updated manifest IDs for AppID ${steamIdInput}.`, 'success');
            success = true;
        }

        // Clear (uncheck) the read-only lock on the Steam appmanifest so the game can update again.
        try {
            if (!detectedSteamPath) detectedSteamPath = await findSteamPath();
            const unlockResult = setAppManifestReadOnly(steamIdInput, false);
            if (unlockResult.found && unlockResult.success) {
                sendStatus(`Update enabled for AppID ${steamIdInput}.`, 'info');
            }
        } catch (unlockErr) {
            console.warn(`Library Update: could not clear read-only for AppID ${steamIdInput}: ${unlockErr.message}`);
        }

    } catch (err) {
        console.warn(`Library Update Error for AppID ${steamIdInput}: ${err.message}`);
        sendStatus(`Library Update failed for AppID ${steamIdInput}`, 'error');
        success = false;
    }

    if (mainWindow) {
        mainWindow.webContents.send('library-item-update-complete', { appId: steamIdInput, success: success });
    }
});

// DISABLE: locks the Steam appmanifest_<appid>.acf (read-only) across all libraries so
// Steam cannot rewrite it — effectively pausing/blocking updates for that game.
ipcMain.handle('disable-appid-manifest', async (event, appId) => {
    if (!isUserPremium) {
        sendStatus('This is a Premium feature.', 'error');
        return { success: false, message: 'Premium feature only.' };
    }
    const appIdStr = String(appId);
    if (!/^\d+$/.test(appIdStr)) {
        sendStatus('Invalid AppID.', 'error');
        return { success: false, message: 'Invalid AppID.' };
    }

    if (!detectedSteamPath) detectedSteamPath = await findSteamPath();

    const result = setAppManifestReadOnly(appIdStr, true);
    if (!result.found) {
        sendStatus(`AppID ${appIdStr} not found.`, 'warning');
        return { success: false, message: 'Manifest not found.' };
    }
    if (!result.success) {
        sendStatus(`Disable failed for AppID ${appIdStr}.`, 'error');
        return { success: false, message: 'Failed to set read-only.' };
    }
    sendStatus(`Update disabled for AppID ${appIdStr}.`, 'success');
    return { success: true, message: 'Manifest set to read-only.' };
});

ipcMain.on('delete-appid-files', async (event, appId, source = 'home-view') => {
    if (!isAuthenticated) {
        sendStatus('Drop Error: Unauthorized. You must log in first.', 'error');
        return;
    }
    let confirmed = false;
    if (source === 'library-view' || source === 'home-view-confirmed') {
        confirmed = true;
    } else {
        sendStatus(`Deletion request for AppID ${appId} requires app confirmation.`, 'warning');
        if (String(source).startsWith('home-view') && mainWindow) mainWindow.webContents.send('status-update', `Deletion process completed for AppID: ${appId} (not confirmed)`, 'info');
        return { success: false, message: 'Deletion requires app confirmation.'};
    }

    if (!confirmed) return { success: false, message: 'Deletion not confirmed.'};

    sendStatus(`Deletion process started for AppID: ${appId}`, 'info');
    let luaFileDeleted = false;
    const steamConfigDirInternal = getSteamConfigPath(); // Internal path

    if (steamConfigDirInternal) {
        const luaFilePathInternal = path.join(steamConfigDirInternal, 'stplug-in', `${appId}.lua`); // Filename okay
        try {
            if (fs.existsSync(luaFilePathInternal)) {
                await fsPromises.unlink(luaFilePathInternal);
                luaFileDeleted = true;
                sendStatus(`Game successfully deleted`, 'success');
            } else {
                sendStatus(`Game file for AppID ${appId} not found. Nothing to delete.`, 'warning'); // Generic filename
            }
        } catch (err) {
            console.warn(`File System Error: Problem deleting game file for AppID ${appId}.`); // Generic
            sendStatus(`Error deleting game file.`, 'error');
        }
    } else {
        sendStatus('Game platform config path not detected. Cannot delete file.', 'warning');
    }

    if (source === 'home-view' && mainWindow) {
         mainWindow.webContents.send('status-update', `Deletion process for AppID ${appId} ${luaFileDeleted ? 'completed.' : 'failed or file not found.'}`, luaFileDeleted ? 'info' : 'error');
    }
    return { success: luaFileDeleted, message: luaFileDeleted ? `${appId} deleted.` : `Failed to delete ${appId} or file not found.` };
});

ipcMain.handle('select-download-location', async () => {
    if (!mainWindow) return { success: false, path: null, message: 'Window not available.' };
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Select Download Location', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths?.[0]) { sendStatus('Download location selection cancelled', 'info'); return { success: false, path: null, message: 'Cancelled.' }; }
    const selectedPath = result.filePaths[0]; // This path is not logged
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        if (!fs.existsSync(selectedPath)) fs.mkdirSync(selectedPath, { recursive: true });
        fs.writeFileSync(CUSTOM_DOWNLOADS_PATH_CONFIG_FILE_INTERNAL, selectedPath); effectiveSteamDownloadsPath = selectedPath;
        sendStatus(`Download location set.`, 'success'); // Generic message
        if (mainWindow) {
             mainWindow.webContents.send('current-save-path',
                effectiveSteamDownloadsPath === DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL ? "Default Location" : "Custom Location"
            );
        }
        return { success: true, path: "Location Set", message: 'Updated.' }; // Return generic path string
    } catch (err) {
        console.warn("File System Error: Problem saving download location."); // Generic
        sendStatus(`Error saving download location.`, 'error');
        return { success: false, path: null, message: `Error saving download location.` };
    }
});

ipcMain.handle('get-current-download-location', async () => {
    if (effectiveSteamDownloadsPath === DEFAULT_STEAM_DOWNLOADS_PATH_INTERNAL) {
        return "Default Location";
    } else if (effectiveSteamDownloadsPath) {
        return "Custom Location";
    }
    return "Default Location"; // Fallback
});
ipcMain.handle('get-auto-save-state', () => autoPlaceFilesEnabled);
ipcMain.on('set-auto-save-state', (event, enabled) => {
    autoPlaceFilesEnabled = !!enabled;
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        fs.writeFileSync(AUTO_PLACE_TOGGLE_CONFIG_FILE_INTERNAL, JSON.stringify({ enabled: autoPlaceFilesEnabled })); // Path not logged
        if (mainWindow) mainWindow.webContents.send('auto-save-state-update', autoPlaceFilesEnabled);
    } catch (err) {
        console.warn("Configuration Error: Problem saving auto-save toggle state."); // Generic
        sendStatus(`Error saving auto-save toggle state.`, 'error');
    }
});

ipcMain.handle('get-dlc-mode-state', () => dlcModeEnabled);
ipcMain.on('set-dlc-mode-state', (event, enabled) => {
    if (!isUserPremium) return; // Block free users
    dlcModeEnabled = !!enabled;
    try {
        if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) fs.mkdirSync(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
        fs.writeFileSync(DLC_TOGGLE_CONFIG_FILE_INTERNAL, JSON.stringify({ enabled: dlcModeEnabled })); // Path not logged
        if (mainWindow) mainWindow.webContents.send('dlc-mode-state-update', dlcModeEnabled);
    } catch (err) {
        console.warn("Configuration Error: Problem saving DLC mode toggle state."); // Generic
        sendStatus(`Error saving DLC mode toggle state.`, 'error');
    }
});

ipcMain.handle('get-unlock-game-state', async () => {
    return unlockGameModeEnabled;
});

ipcMain.on('set-unlock-game-state', async (event, enabled) => {
    if (process.platform !== 'win32') {
        sendStatus('Unlock Game: This feature is only available on Windows.', 'warning');
        if (mainWindow) mainWindow.webContents.send('unlock-game-state-update', false);
        return;
    }

    const valueToWrite = enabled ? 'true' : 'false';
    try {
        await writeSteamToolsRegistryValue(REG_ACTIVATE_UNLOCK_MODE_INTERNAL, valueToWrite); // Registry path not logged by function
        await writeSteamToolsRegistryValue(REG_ALWAYS_STAY_UNLOCKED_INTERNAL, valueToWrite);
        unlockGameModeEnabled = enabled;
    } catch (err) {
        await loadInitialUnlockGameState();
        return;
    }
    if (mainWindow) {
        mainWindow.webContents.send('unlock-game-state-update', unlockGameModeEnabled);
    }
});


ipcMain.on('add-all-dlcs-for-game', async (event, mainGameAppId) => {
    if (!isAuthenticated || !isUserPremium) { 
        forceLogoutTamperDetected();
        return; 
    }
    if (!isUserPremium) { sendDlcStatus('DLC addition is a premium feature.', 'warning'); await finishDlcToggle(mainGameAppId, false); return; }
    if (!mainGameAppId || !/^\d+$/.test(mainGameAppId)) {
        sendDlcStatus(`Invalid Main Game AppID provided: ${mainGameAppId}`, 'error');
        sendDlcStatus('DLC addition process failed.', 'error'); await finishDlcToggle(mainGameAppId, false); return;
    }
    sendDlcStatus(`Checking additional content to add for ${mainGameAppId}`, 'progress');
    const officialDlcIds = await scrapeDlcAppIds(mainGameAppId);
    if (!Array.isArray(officialDlcIds)) { sendDlcStatus(`DLC addition process failed for ${mainGameAppId}. Could not retrieve list.`, 'error'); await finishDlcToggle(mainGameAppId, false); return; }
    if (officialDlcIds.length === 0) { sendDlcStatus(`No additional content found to add for ${mainGameAppId}. Process finished.`, 'info'); await finishDlcToggle(mainGameAppId, false); return; }
    sendDlcStatus(`Found ${officialDlcIds.length} official additional content item(s) for ${mainGameAppId}. Attempting to add`, 'info');
    for (const dlcId of officialDlcIds) { await addSingleDlcToSteamtoolsLua(dlcId); }
    await finishDlcToggle(mainGameAppId, true);
    sendDlcStatus(`Additional content addition process for ${mainGameAppId} has been added.`, 'success');
});

ipcMain.on('remove-all-dlcs-for-game', async (event, mainGameAppId) => {
    if (!isAuthenticated || !isUserPremium) { 
        forceLogoutTamperDetected();
        return; 
    }
    if (!isUserPremium) { sendDlcStatus('DLC removal is a premium feature.', 'warning'); await finishDlcToggle(mainGameAppId, false); return; }
    if (!mainGameAppId || !/^\d+$/.test(mainGameAppId)) {
        sendDlcStatus(`Invalid Main Game AppID provided: ${mainGameAppId}`, 'error');
        sendDlcStatus('DLC removal process failed.', 'error'); await finishDlcToggle(mainGameAppId, false); return;
    }
    sendDlcStatus(`Checking additional content to remove for ${mainGameAppId}`, 'progress');
    const officialDlcIds = await scrapeDlcAppIds(mainGameAppId);
    if (!Array.isArray(officialDlcIds)) { sendDlcStatus(`DLC removal process failed for ${mainGameAppId}. Could not retrieve list.`, 'error'); await finishDlcToggle(mainGameAppId, false); return; }
    if (officialDlcIds.length === 0) { sendDlcStatus(`No additional content found to remove for ${mainGameAppId}. Process finished.`, 'info'); await finishDlcToggle(mainGameAppId, false); return; }
    sendDlcStatus(`Found ${officialDlcIds.length} official additional content item(s) for ${mainGameAppId}. Attempting to remove`, 'info');
    let anyRemovedSuccessfully = false;
    for (const dlcId of officialDlcIds) { const removed = await removeDlcEntryFromSteamtoolsLua(dlcId); if (removed) anyRemovedSuccessfully = true; }
    await finishDlcToggle(mainGameAppId, false);
    if (anyRemovedSuccessfully) {
    sendDlcStatus(`Additional content removal process for ${mainGameAppId} completed.`, 'info');
} else {
    sendDlcStatus(`Additional content removal for ${mainGameAppId}: No matching entries found. Process finished.`, 'error');
}
});

ipcMain.handle('get-library-games', async () => {
    if (!isAuthenticated) return { success: false, games: [], message: 'Please log in first.' };
    if (!isUserPremium) return { success: false, games: [], message: 'Steam Library is a premium feature.' };
    if (!detectedSteamPath) detectedSteamPath = await findSteamPath();

    const luaAppIds = new Set();
    const steamConfigPathInternal = getSteamConfigPath(); // Internal
    if (steamConfigPathInternal) {
        const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in'); // Internal
        if (fs.existsSync(stplugInDirInternal)) {
            try {
                const luaFiles = await fsPromises.readdir(stplugInDirInternal);
                for (const file of luaFiles) {
                    const lower = file.toLowerCase();
                    if (!lower.endsWith('.lua')) continue;
                    if (lower === STEAMTOOLS_LUA_FILENAME_INTERNAL.toLowerCase()) continue;
                    const appId = file.substring(0, file.length - 4);
                    if (/^\d+$/.test(appId)) luaAppIds.add(appId);
                }
            } catch (err) {
                console.warn("File System Error: Problem reading game library files."); // Generic
            }
        }
    }

    const installedAppIds = new Set();
    for (const dir of findAllSteamappsDirs()) {
        let files;
        try { files = fs.readdirSync(dir); } catch (e) { continue; }
        for (const file of files) {
            const match = /^appmanifest_(\d+)\.acf$/i.exec(file);
            if (match && !NON_GAME_APP_IDS.has(match[1])) installedAppIds.add(match[1]);
        }
    }

    const gameAppIds = Array.from(new Set([...luaAppIds, ...installedAppIds]));
    if (gameAppIds.length === 0) return { success: true, games: [], message: 'No library or installed games found.' };

    const dlcState = await readDlcAddedState();
    const onlinePaths = await readOnlinePathsFile();
    const gameDataPromises = gameAppIds.map(async (appId) => {
        const info = await getLibraryGameInfo(appId); // cached name + CDN image, no rate-limited API call unless needed
        if (installedAppIds.has(appId) && (!info.name || info.name.startsWith('AppID:'))) {
            const install = getSteamGameInstall(appId);
            if (install && install.name) info.name = install.name;
        }
        const onlineFixData = onlinePaths[String(appId)];
        return {
            ...info,
            hasLua: luaAppIds.has(appId),
            installed: installedAppIds.has(appId),
            dlcAdded: !!dlcState[String(appId)],
            onlineFixApplied: !!(onlineFixData && Array.isArray(onlineFixData.managedFiles) && onlineFixData.managedFiles.length > 0)
        };
    });
    const games = await Promise.all(gameDataPromises);
    games.sort((a, b) => {
        if (a.hasLua !== b.hasLua) return a.hasLua ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return { success: true, games: games, message: `Fetched ${games.length} games.` };
});

// AppIDs that have an appmanifest but are not games (Steam runtimes / redistributables /
// Proton). These are filtered out of the Update view.
const NON_GAME_APP_IDS = new Set([
    '228980',   // Steamworks Common Redistributables
    '1070560',  // Steam Linux Runtime 1.0 (scout)
    '1391110',  // Steam Linux Runtime 2.0 (soldier)
    '1628350',  // Steam Linux Runtime 3.0 (sniper)
    '1493710',  // Proton Experimental
    '2348590',  // Proton 9.0
    '2805730',  // Proton Hotfix
    '1245040',  // Proton 5.13
    '1420170',  // Proton 6.3
    '1580130',  // Proton 7.0
    '1887720',  // Proton 8.0
    '858280',   // Proton 3.7
    '930400',   // Proton 3.16
    '961940',   // Proton 4.2
    '1054830',  // Proton 4.11
    '1113280'   // Proton 5.0
]);

// Backs the Update view: only games that are actually installed, i.e. have an
// appmanifest_<appid>.acf in any steamapps library on this PC.
ipcMain.handle('get-installed-games', async () => {
    if (!isUserPremium) return { success: false, games: [], message: 'Premium feature only.' };
    if (!detectedSteamPath) detectedSteamPath = await findSteamPath();

    // 1. Build the set of AppIDs that are in the user's library (have a .lua in stplug-in).
    const libraryAppIds = new Set();
    const steamConfigPathInternal = getSteamConfigPath();
    if (steamConfigPathInternal) {
        const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in');
        if (fs.existsSync(stplugInDirInternal)) {
            try {
                const luaFiles = fs.readdirSync(stplugInDirInternal);
                for (const f of luaFiles) {
                    if (!f.toLowerCase().endsWith('.lua')) continue;
                    if (f.toLowerCase() === STEAMTOOLS_LUA_FILENAME_INTERNAL.toLowerCase()) continue;
                    const id = f.substring(0, f.length - 4);
                    if (/^\d+$/.test(id)) libraryAppIds.add(id);
                }
            } catch (e) { /* silent fail */ }
        }
    }
    if (libraryAppIds.size === 0) return { success: true, games: [], message: 'No games found in library.' };

    // 2. Keep only library games that are also installed (have an appmanifest_<appid>.acf).
    const steamappsDirs = findAllSteamappsDirs();
    if (steamappsDirs.length === 0) return { success: true, games: [], message: 'No game libraries found.' };

    const appIdSet = new Set();
    for (const dir of steamappsDirs) {
        let files;
        try { files = fs.readdirSync(dir); } catch (e) { continue; }
        for (const f of files) {
            const m = /^appmanifest_(\d+)\.acf$/i.exec(f);
            if (m && !NON_GAME_APP_IDS.has(m[1]) && libraryAppIds.has(m[1])) appIdSet.add(m[1]);
        }
    }

    const appIds = Array.from(appIdSet);
    if (appIds.length === 0) return { success: true, games: [], message: 'No installed library games found.' };

    const games = await Promise.all(appIds.map(appId => scrapeSteamGameInfo(appId)));
    return { success: true, games: games, message: `Found ${games.length} installed games.` };
});

ipcMain.handle('get-steam-installed-games', async () => {
    if (!isUserPremium) return { success: false, games: [], message: 'Premium feature only.' };
    if (!detectedSteamPath) detectedSteamPath = await findSteamPath();

    const steamappsDirs = findAllSteamappsDirs();
    if (steamappsDirs.length === 0) return { success: true, games: [], message: 'No game libraries found.' };

    const appIdSet = new Set();
    for (const dir of steamappsDirs) {
        let files;
        try { files = fs.readdirSync(dir); } catch (e) { continue; }
        for (const f of files) {
            const m = /^appmanifest_(\d+)\.acf$/i.exec(f);
            if (m && !NON_GAME_APP_IDS.has(m[1])) appIdSet.add(m[1]);
        }
    }

    const appIds = Array.from(appIdSet);
    if (appIds.length === 0) return { success: true, games: [], message: 'No installed games found.' };

    const dlcState = await readDlcAddedState();
    const games = await Promise.all(appIds.map(async (appId) => {
        const info = await scrapeSteamGameInfo(appId);
        info.dlcAdded = !!dlcState[String(appId)];
        return info;
    }));
    return { success: true, games: games, message: `Found ${games.length} installed games.` };
});

ipcMain.handle('steamless-get-installed-games', async () => {
    if (!isUserPremium) return { success: false, games: [], message: 'Premium feature only.' };
    if (process.platform !== 'win32') return { success: false, games: [], message: 'Patch Hub is available on Windows only.' };
    if (!detectedSteamPath) detectedSteamPath = await findSteamPath();

    const steamappsDirs = findAllSteamappsDirs();
    if (steamappsDirs.length === 0) return { success: true, games: [], message: 'No game libraries found.' };

    const appIdSet = new Set();
    for (const dir of steamappsDirs) {
        let files;
        try { files = fs.readdirSync(dir); } catch (e) { continue; }
        for (const f of files) {
            const m = /^appmanifest_(\d+)\.acf$/i.exec(f);
            if (m && !NON_GAME_APP_IDS.has(m[1])) appIdSet.add(m[1]);
        }
    }

    const appIds = Array.from(appIdSet);
    if (appIds.length === 0) return { success: true, games: [], message: 'No installed games found.' };

    const games = await Promise.all(appIds.map(async (appId) => {
        const install = getSteamGameInstall(appId);
        const info = await scrapeSteamGameInfo(appId);
        if (install && (!info.name || info.name.startsWith('AppID:'))) info.name = install.name;
        const dllState = getSteamlessDllState(install);
        return {
            appId: String(appId),
            name: info.name || (install && install.name) || `AppID: ${appId}`,
            imageUrl: info.imageUrl || '',
            steamlessDllFound: dllState.found,
            steamlessDllEnabled: dllState.enabled,
            steamlessDllName: dllState.fileName
        };
    }));

    return { success: true, games, message: `Found ${games.length} installed games.` };
});

ipcMain.handle('steamless-set-dll-state', async (event, appId, enable) => {
    if (!isUserPremium) return { success: false, enabled: false, message: 'Sorry, this game cannot be patched.' };
    if (process.platform !== 'win32') return { success: false, enabled: false, message: 'Sorry, this game cannot be patched.' };

    try {
        const install = getSteamGameInstall(appId);
        if (!install) throw new Error('Installed game folder was not found.');

        const result = await setSteamlessDllStateForInstall(install, !!enable);
        return result;
    } catch (e) {
        return { success: false, found: true, enabled: !enable, message: 'Sorry, this game cannot be patched.' };
    }
});

ipcMain.handle('steamless-launch-game', async (event, appId) => {
    if (!isUserPremium) return { success: false, message: 'Sorry, this game cannot be launched.' };
    if (process.platform !== 'win32') return { success: false, message: 'Sorry, this game cannot be launched.' };

    try {
        const install = getSteamGameInstall(appId);
        if (!install) throw new Error('Installed game folder was not found.');
        launchSteamlessGame(install);
        return { success: true, message: 'Game launched.' };
    } catch (e) {
        return { success: false, message: 'Sorry, this game cannot be launched.' };
    }
});

ipcMain.handle('get-online-games', async () => {
    if (!isUserPremium) return { success: false, games: [], message: 'Premium feature only.' };
    const steamConfigPathInternal = getSteamConfigPath(); // Internal
    if (!steamConfigPathInternal) return { success: false, games: [], message: 'Game platform config path not found.' };
    const stplugInDirInternal = path.join(steamConfigPathInternal, 'stplug-in'); // Internal
    if (!fs.existsSync(stplugInDirInternal)) return { success: true, games: [], message: 'Game data directory not found.' }; // Generic
    let luaFiles;
    try { luaFiles = await fsPromises.readdir(stplugInDirInternal); }
    catch (err) {
        console.warn("File System Error: Problem reading game library files."); // Generic
        return { success: false, games: [], message: 'Error reading game library files.' };
    }
    // Filenames are okay here as they are derived from user actions/appids
    const gameAppIds = luaFiles.filter(file => file.toLowerCase().endsWith('.lua') && file.toLowerCase() !== STEAMTOOLS_LUA_FILENAME_INTERNAL.toLowerCase()).map(file => file.substring(0, file.length - 4)).filter(appId => /^\d+$/.test(appId));
    if (gameAppIds.length === 0) return { success: true, games: [], message: 'No games found in library.' };
    const gameDataPromises = gameAppIds.map(appId => getLibraryGameInfo(appId)); // cached name + CDN image, no rate-limited API call
    const games = await Promise.all(gameDataPromises);
    return { success: true, games: games, message: `Fetched ${games.length} games.` };
});

ipcMain.handle('stop-steam', async () => {
    if (!isUserPremium) {
        sendStatus('Stop Game Platform is a premium feature.', 'warning');
        return { success: false, message: 'Premium feature only.' };
    }
    sendStatus('Attempting to stop game platform process...', 'info');
    const killed = await killSteamProcesses(); // killSteamProcesses handles generic logging
    if (killed) {
        if (!await isSteamRunning()) {
            sendStatus('Game platform process stopped successfully.', 'success');
            return { success: true, message: 'Game platform stopped.' };
        } else {
            sendStatus('Issued stop command, but game platform might still be running or closing slowly.', 'warning');
            return { success: false, message: 'Game platform stop initiated, but verify process.' };
        }
    } else {
        return { success: false, message: 'Failed to stop game platform or it was not running.' };
    }
});

async function internalGetGameExtendedInfo(appId, initialNameFromSearch = null) {
    if (!appId || !/^\d+$/.test(appId)) {
        return { success: false, message: 'Invalid AppID format provided.' };
    }

    const originalCurrentGameName = currentGameName;
    let tempCurrentGameName = initialNameFromSearch || `AppID: ${appId}`;

    const apiInfo = await scrapeSteamGameInfo(appId); // Returns sanitized error messages

    let finalGameName = initialNameFromSearch ? sanitizeFilename(initialNameFromSearch) : null;

    if (!finalGameName || finalGameName.startsWith(`AppID: ${appId}`)) {
        if (apiInfo.name && !apiInfo.name.startsWith(`AppID: ${appId}`)) {
            finalGameName = apiInfo.name;
        } else {
            finalGameName = `AppID: ${appId}`;
        }
    }

    tempCurrentGameName = finalGameName;

    if (apiInfo.isApiErrorNotFound && !apiInfo.name.includes('(API Network Error)')) {
        return { success: false, message: `AppID ${appId} not found or API error.`,
                 gameData: { appId, name: finalGameName , imageUrl: apiInfo.imageUrl, displayStatus: 'api_error', rawDrmResultStatus: 'invalid_api', type: apiInfo.data?.type } };
    }
    if (apiInfo.error && !apiInfo.name.includes('(API Error/Not Found)') && !apiInfo.name.includes('(API Invalid Response)')) {
        return { success: false, message: apiInfo.error, // apiInfo.error is already generic
                 gameData: { appId, name: finalGameName , imageUrl: apiInfo.imageUrl, displayStatus: 'api_error', rawDrmResultStatus: 'failed_api_fetch', type: apiInfo.data?.type } };
    }

    const drmCheckResult = await checkDrm(appId, true); // Returns sanitized error messages if any

    if (drmCheckResult.gameName && drmCheckResult.gameName !== `AppID: ${appId}`) {
         if (!initialNameFromSearch || (initialNameFromSearch && drmCheckResult.gameName.length > initialNameFromSearch.length && !drmCheckResult.gameName.includes(`AppID: ${appId}`))) {
             finalGameName = drmCheckResult.gameName;
        }
    }

    let displayStatus = 'unknown';
    let drmsFound = [];
    let gameType = apiInfo.data?.type;

    if (apiInfo.data && apiInfo.data.release_date && apiInfo.data.release_date.coming_soon === true) {
        displayStatus = 'coming_soon';
    } else {
        switch (drmCheckResult.status) {
            case 'drm_found':
                displayStatus = 'not_playable';
                drmsFound = drmCheckResult.drms; // drms list itself is not logged to user
                break;
            case 'success':
                if (apiInfo.data && apiInfo.data.is_free === true) {
                    displayStatus = 'free_to_play';
                } else {
                    displayStatus = 'playable';
                }
                break;
            case 'age_restricted': displayStatus = 'age_restricted'; break;
            case 'region_locked': displayStatus = 'region_locked'; break;
            case 'invalid_api': displayStatus = 'api_error'; break;
            case 'invalid_store':
                displayStatus = 'store_invalid';
                if (finalGameName === `AppID: ${appId}` && apiInfo.name && !apiInfo.name.startsWith(`AppID: ${appId}`)) {
                    finalGameName = apiInfo.name;
                }
                break;
            case 'failed_http_store':
            case 'failed_store_scrape':
                displayStatus = 'store_error';
                if (finalGameName === `AppID: ${appId}` && apiInfo.name && !apiInfo.name.startsWith(`AppID: ${appId}`)) {
                    finalGameName = apiInfo.name;
                }
                break;
            default:
                displayStatus = drmCheckResult.status || 'unknown_error';
                 if (finalGameName === `AppID: ${appId}` && apiInfo.name && !apiInfo.name.startsWith(`AppID: ${appId}`)) {
                    finalGameName = apiInfo.name;
                }
                break;
        }
    }
     if (apiInfo.name.includes('(API Network Error)') && (displayStatus === 'playable' || displayStatus === 'free_to_play' || displayStatus === 'coming_soon')) {
        // Name should be good
    }
     if (finalGameName === `AppID: ${appId}`) {
        if (initialNameFromSearch && initialNameFromSearch !== `AppID: ${appId}`) {
            finalGameName = initialNameFromSearch;
        } else if (apiInfo.name && !apiInfo.name.startsWith(`AppID: ${appId}`)) {
            finalGameName = apiInfo.name;
        }
    }
    if (gameType && gameType.toLowerCase() !== 'game' && gameType.toLowerCase() !== 'dlc') {
        const typeString = `(${gameType.charAt(0).toUpperCase() + gameType.slice(1)})`;
        if (!finalGameName.toLowerCase().includes(gameType.toLowerCase())) {
            finalGameName = `${finalGameName} ${typeString}`;
        }
    }

    return {
        success: !['api_error', 'store_invalid', 'store_error', 'unknown_error'].includes(displayStatus) && (drmCheckResult.status !== 'invalid_api'),
        gameData: {
            appId,
            name: finalGameName,
            imageUrl: apiInfo.imageUrl, // Not logged directly
            displayStatus: displayStatus,
            drms: drmsFound, // Not logged directly
            rawDrmResultStatus: drmCheckResult.status,
            type: gameType,
            releaseDate: apiInfo.data?.release_date?.date || '',
            genres: Array.isArray(apiInfo.data?.genres)
                ? apiInfo.data.genres.map(g => g.description).filter(Boolean)
                : []
        }
    };
}

ipcMain.handle('get-game-extended-info', async (event, appId, initialNameFromSearch = null) => {
    // if (!isUserPremium) return { success: false, message: 'Premium feature only.', gameData: null };
    const originalCurrentGameName = currentGameName;
    const result = await internalGetGameExtendedInfo(appId, initialNameFromSearch);
    currentGameName = originalCurrentGameName;
    return result;
});


// Resolves the real header image for one AppID. The library/online views build a
// predictable CDN url first; brand-new releases store art under an unpredictable
// hash path, so on a 404 the renderer asks here for the API's header_image.
ipcMain.handle('get-game-image', async (event, appId) => {
    const info = await scrapeSteamGameInfo(String(appId));
    return { success: !!info.imageUrl, imageUrl: info.imageUrl || '' };
});


ipcMain.handle('find-appid-by-title', async (event, gameTitle) => {
    // if (!isUserPremium) return { success: false, games: [], message: 'Premium feature only.' };
    if (!gameTitle || typeof gameTitle !== 'string' || gameTitle.trim() === '') {
        return { success: false, games: [], message: "Game title cannot be empty." };
    }
    const searchUrlInternal = `${STEAM_API_BASE_INTERNAL.storesearch}?term=${encodeURIComponent(gameTitle.trim())}&l=english&cc=us&category1=998&count=10`; // Internal URL

    try {
        const response = await got(searchUrlInternal, {
            timeout: { request: 15000 },
            responseType: 'json',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        if (response.body && response.body.items && response.body.items.length > 0) {
            const games = response.body.items
                .filter(item => item.id && item.name && (item.type === 'app' || item.type === 'game'))
                .slice(0, 5)
                .map(item => {
                    return {
                        appId: String(item.id),
                        name: item.name,
                        type: item.type
                    };
                });

            if (games.length > 0) {
                return { success: true, games: games };
            }
        }
        return { success: false, games: [], message: `No relevant games found matching "${gameTitle}".` };
    } catch (error) {
        console.warn(`Network Error: Failed to search for game title "${gameTitle}".`); // Generic console
        let errorMessage = 'Failed to search for game: Network error.';
        if (error.name === 'TimeoutError') {
            errorMessage = 'Failed to search for game: Request timed out.';
        } else if (error.response && error.response.statusCode) {
            errorMessage = `Failed to search for game: Server responded with an error.`; // Generic
        }
        return { success: false, games: [], message: errorMessage };
    }
});

// Logic for Remove Old Steam (Update/Restore)
async function removeOldSteam() {
    sendStatus('Restoring Steam to latest version...', 'info');
    if (!detectedSteamPath) return false;

    const cfgPath = path.join(detectedSteamPath, 'steam.cfg');
    try {
        await killSteamProcessesSilently();
        
        if (fs.existsSync(cfgPath)) {
            await fsPromises.unlink(cfgPath);
            sendStatus('steam.cfg removed. Steam will now update on next launch.', 'success');
        } else {
            sendStatus('Old Steam (steam.cfg) was not detected. Steam is likely normal.', 'info');
        }
        return true;
    } catch (error) {
        sendStatus('Error while restoring Steam.', 'error');
        return false;
    }
}

async function applySteamFix() {
    sendStatus('Initiating Steam Fix...', 'info');
    
    // Ensure we have the path
    if (!detectedSteamPath) {
        detectedSteamPath = await findSteamPath();
    }
    
    if (!detectedSteamPath) {
        sendStatus('Steam folder not detected. Cannot apply fix.', 'error');
        return false;
    }

    // 1. Stop Steam
    sendStatus('Stopping Steam...', 'info');
    await killSteamProcessesSilently();
    await new Promise(r => setTimeout(r, 2000)); // Give it 2 seconds to fully exit

    const tempZipPath = path.join(os.tmpdir(), `steam-fix-${Date.now()}.zip`);
    try {
        // 2. Remove old redirect files before applying the bundled fix.
        sendStatus('Removing old Steam Fix files...', 'progress');
        const cloudRedirectDllPath = path.join(detectedSteamPath, 'cloud_redirect.dll');
        const cloudRedirectFolderPath = path.join(detectedSteamPath, 'cloud_redirect');
        if (fs.existsSync(cloudRedirectDllPath)) {
            await fsPromises.rm(cloudRedirectDllPath, { force: true });
        }
        if (fs.existsSync(cloudRedirectFolderPath)) {
            await fsPromises.rm(cloudRedirectFolderPath, { recursive: true, force: true });
        }

        // 3. Download the fix
        sendStatus('Downloading Steam Fix...', 'progress');
        await pipeline(got.stream(STEAM_FIX_URL_INTERNAL), fs.createWriteStream(tempZipPath));

        // 4. Extract and Overwrite into Steam Root
        sendStatus('Replacing files in Steam folder...', 'progress');
        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(detectedSteamPath, true); // 'true' forces overwriting existing files

        // 5. Remove wtsapi32.dll from the Steam root if it exists.
        const wtsapiPath = path.join(detectedSteamPath, 'wtsapi32.dll');
        if (fs.existsSync(wtsapiPath)) {
            try { fs.unlinkSync(wtsapiPath); } catch (e) { console.warn('Could not delete wtsapi32.dll:', e); }
        }

        sendStatus('Steam Fix applied successfully. Restarting Steam...', 'success');

        // 6. Restart Steam
        await startSteamProcess();
        return true;

    } catch (error) {
        console.error(error);
        sendStatus(`Failed to apply Steam Fix.`, 'error');
        return false;
    } finally {
        // Clean up temp files
        if (fs.existsSync(tempZipPath)) try { fs.unlinkSync(tempZipPath); } catch (e) {}
    }
}

async function applyOldSteam() {
    sendStatus('Initiating Old Steam downgrade...', 'info');
    if (!detectedSteamPath) return false;

    await killSteamProcessesSilently();
    await new Promise(r => setTimeout(r, 1500));

    const tempZipPath = path.join(os.tmpdir(), `old-steam-${Date.now()}.zip`);
    try {
        sendStatus('Downloading Old Steam files...', 'progress');
        await pipeline(got.stream(OLD_STEAM_URL_INTERNAL), fs.createWriteStream(tempZipPath));

        sendStatus('Replacing files in Steam folder...', 'progress');
        await extractZip(tempZipPath, { dir: detectedSteamPath });

        sendStatus('Old Steam applied successfully.', 'success');
        return true;
    } catch (error) {
        sendStatus(`Failed to apply Old Steam.`, 'error');
        return false;
    } finally {
        if (fs.existsSync(tempZipPath)) try { fs.unlinkSync(tempZipPath); } catch (e) {}
    }
}

// Add inside the IPC Handlers section

ipcMain.handle('apply-old-steam', async () => { if (!isUserPremium) return { success: false, message: 'Premium only' }; return await applyOldSteam(); });
ipcMain.handle('remove-old-steam', async () => { if (!isUserPremium) return { success: false, message: 'Premium only' }; return await removeOldSteam(); });
ipcMain.handle('apply-steam-fix', async () => { if (!isUserPremium) return { success: false, message: 'Premium only' }; return await applySteamFix(); });

async function killSteamProcessesSilently() {
    try {
        if (process.platform === 'win32') {
            // Added || true to the command to prevent it from throwing a hard error if process isn't found
            execSync('taskkill /F /IM steam.exe /T', { stdio: 'ignore' });
        } else {
            execSync('pkill -f steam', { stdio: 'ignore' });
        }
    } catch (e) {
        // We ignore the error because if it's not running, that's what we wanted anyway
        console.log("Steam process not found or already closed. Proceeding...");
    }
    return true;
}

async function scrapeSteamChartData(chartType) {
    // --- 1. LOCAL CACHE READ LOGIC ---
    try {
        if (fs.existsSync(CHART_CACHE_FILE_INTERNAL)) {
            const cacheContent = await fsPromises.readFile(CHART_CACHE_FILE_INTERNAL, 'utf-8');
            const cacheData = JSON.parse(cacheContent);
            
            // If we have cache for this chart type, check how old it is
            if (cacheData[chartType] && cacheData[chartType].timestamp) {
                const ageMs = Date.now() - cacheData[chartType].timestamp;
                const cachedGames = cacheData[chartType].data?.games || [];
                const cacheHasGenres = cachedGames.length === 0 || cachedGames.some(game => Array.isArray(game.genres) && game.genres.length > 0);
                if (ageMs < CHART_CACHE_DURATION_MS && cacheData[chartType].schemaVersion === CHART_CACHE_SCHEMA_VERSION && cacheHasGenres) {
                    return cacheData[chartType].data;
                } else {
                    sendStatus(`Chart: Cache expired. Fetching fresh data...`, 'info');
                }
            }
        }
    } catch (cacheReadError) {
        console.warn("Cache Error: Failed to read chart cache. Fetching fresh data.");
    }
    // ---------------------------------

    const chartConfigsInternal = { // Internal config
        week: {
            url: "https://store.steampowered.com/explore/new/", // Internal URL
            appIdSelector: 'div.bucket:has(h2:contains("New Top Sellers")) div.store_horizontal_autoslider_ctn div.store_horizontal_autoslider a[data-ds-appid], #NewReleasesRows a[data-ds-appid], div.home_tabs_content a[data-ds-appid], div.store_capsule_container a[data-ds-appid]',
            maxAppIdsToGrab: 20,
            debugName: "Popular New Releases" // For internal debug, not logged to user
        }
    };

    if (!chartConfigsInternal[chartType]) {
        sendStatus(`Chart: Invalid chart type requested: ${chartType}`, 'error');
        return { success: false, games: [], message: "Invalid chart type." };
    }

    const config = chartConfigsInternal[chartType];
    const TARGET_SUITABLE_GAMES_COUNT = 15;
    const appIdsFromPage = new Set();
    const suitableGames = [];

    try {
        const response = await got(config.url, {
            timeout: { request: 25000 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'wants_mature_content=1; birthtime=-2208988799; steamCountry=US;',
            },
            throwHttpErrors: false
        });

        if (response.statusCode !== 200) {
            let errorDetail = `(Server error)`; // Generic
            if (response.url.includes('/agecheck/')) { // Standard URL part check
                errorDetail = "(Content restriction page)";
            }
            return { success: false, games: [], message: `Failed to fetch games for chart ${errorDetail}` };
        }

        const $ = cheerio.load(response.body);

        $(config.appIdSelector).each((i, elem) => {
            if (appIdsFromPage.size >= config.maxAppIdsToGrab) {
                return false;
            }
            const appId = $(elem).attr('data-ds-appid');
            if (appId && /^\d+$/.test(appId)) {
                appIdsFromPage.add(appId);
            }
        });

        const uniqueAppIdsArray = Array.from(appIdsFromPage);

        if (uniqueAppIdsArray.length === 0) {
            return { success: true, games: [], message: `No AppIDs found on "${config.debugName}" chart page.` };
        }

        const gameDetailPromises = uniqueAppIdsArray.map(appId =>
            internalGetGameExtendedInfo(appId, null) // Returns sanitized error messages
                .catch(err => {
                    return { success: false, gameData: { appId, name: `AppID ${appId} (Error)`, displayStatus: 'api_error' } };
                })
        );

        const settledResults = await Promise.allSettled(gameDetailPromises);

        for (const result of settledResults) {
            if (suitableGames.length >= TARGET_SUITABLE_GAMES_COUNT) break;

            if (result.status === 'fulfilled' && result.value.success && result.value.gameData) {
                const gameData = result.value.gameData;
                if (gameData.displayStatus !== 'free_to_play' &&
                    gameData.type && gameData.type.toLowerCase() !== 'dlc' &&
                    !['api_error', 'store_invalid', 'store_error', 'unknown_error', 'coming_soon'].includes(gameData.displayStatus)
                   ) {
                    suitableGames.push(gameData);
                }
            }
        }

        if (suitableGames.length === 0) {
            return { success: true, games: [], message: `No suitable games found for chart after checking ${uniqueAppIdsArray.length} AppIDs.` }; // Generic
        }

        const gamesToDisplay = suitableGames.slice(0, TARGET_SUITABLE_GAMES_COUNT);
        const finalResult = { success: true, games: gamesToDisplay, message: `Fetched ${gamesToDisplay.length} suitable games.` };

        // --- 2. LOCAL CACHE WRITE LOGIC ---
        try {
            if (!fs.existsSync(LUA_FOLDER_PATH_INTERNAL)) {
                await fsPromises.mkdir(LUA_FOLDER_PATH_INTERNAL, { recursive: true });
            }
            
            let currentCache = {};
            if (fs.existsSync(CHART_CACHE_FILE_INTERNAL)) {
                try {
                    const existingData = await fsPromises.readFile(CHART_CACHE_FILE_INTERNAL, 'utf-8');
                    currentCache = JSON.parse(existingData);
                } catch (e) {
                    // Ignore JSON parse errors and just overwrite if corrupted
                }
            }

            // Update just this specific chart type
            currentCache[chartType] = {
                timestamp: Date.now(),
                schemaVersion: CHART_CACHE_SCHEMA_VERSION,
                data: finalResult
            };

            await fsPromises.writeFile(CHART_CACHE_FILE_INTERNAL, JSON.stringify(currentCache, null, 2), 'utf-8');
            sendStatus(`Chart: Saved fresh data to local cache.`, 'info');
        } catch (cacheWriteError) {
            console.warn("Cache Error: Failed to write to chart cache file.");
        }
        // ----------------------------------

        return finalResult;

    } catch (error) {
        console.warn(`CRITICAL ERROR scraping AppIDs for ${chartType} chart.`); // Generic console
        return { success: false, games: [], message: `Error scraping AppIDs.` }; // Generic message
    }
}

ipcMain.handle('scrape-steam250-chart', async (event, chartType) => {
   // if (!isUserPremium) {return { success: false, games: [], message: "This feature is for premium users only." }; }
    return scrapeSteamChartData('week'); // 'week' is an identifier
});

async function scrapeSteamTopSellersPage(start, count, tagId = null) {
    const safeTag = tagId && /^\d+$/.test(String(tagId)) ? String(tagId) : null;
    const tagParam = safeTag ? `&tags=${safeTag}` : '';
    const url = `https://store.steampowered.com/search/results/?query&start=${start}&count=${count}&dynamic_data=&snr=1_7_7_globaltopsellers_7&filter=topsellers&category1=998${tagParam}&infinite=1`;
    try {
        const response = await got(url, {
            timeout: { request: 25000 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept': 'application/json,text/javascript,*/*;q=0.01',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'wants_mature_content=1; birthtime=-2208988799; steamCountry=US;',
                'X-Requested-With': 'XMLHttpRequest',
            },
            responseType: 'json',
            throwHttpErrors: false
        });

        if (response.statusCode !== 200 || !response.body || !response.body.results_html) {
            return { success: false, games: [], hasMore: false, nextStart: start, message: 'Failed to fetch additional games.' };
        }

        const totalCount = typeof response.body.total_count === 'number' ? response.body.total_count : null;
        const $ = cheerio.load(response.body.results_html);

        const appIds = [];
        const seen = new Set();
        $('a[data-ds-appid]').each((i, elem) => {
            const raw = $(elem).attr('data-ds-appid') || '';
            const first = raw.split(',')[0].trim();
            if (/^\d+$/.test(first) && !seen.has(first)) {
                seen.add(first);
                appIds.push(first);
            }
        });

        const rowsScanned = appIds.length;
        if (rowsScanned === 0) {
            return { success: true, games: [], hasMore: false, nextStart: start, message: 'No more results.' };
        }

        const detailPromises = appIds.map(appId =>
            internalGetGameExtendedInfo(appId, null).catch(() => ({
                success: false,
                gameData: { appId, name: `AppID ${appId} (Error)`, displayStatus: 'api_error' }
            }))
        );
        const settled = await Promise.allSettled(detailPromises);

        const suitable = [];
        for (const r of settled) {
            if (r.status === 'fulfilled' && r.value.success && r.value.gameData) {
                const g = r.value.gameData;
                if (g.displayStatus !== 'free_to_play' &&
                    g.type && g.type.toLowerCase() !== 'dlc' &&
                    !['api_error', 'store_invalid', 'store_error', 'unknown_error', 'coming_soon'].includes(g.displayStatus)) {
                    suitable.push(g);
                }
            }
        }

        const nextStart = start + rowsScanned;
        const hasMore = totalCount === null ? rowsScanned >= count : nextStart < totalCount;

        return { success: true, games: suitable, hasMore, nextStart, message: `Fetched ${suitable.length} additional games.` };
    } catch (error) {
        console.warn('Error fetching additional games page.');
        return { success: false, games: [], hasMore: false, nextStart: start, message: 'Error fetching additional games.' };
    }
}

ipcMain.handle('fetch-more-gamelist', async (event, start, count) => {
    const s = Number.isInteger(start) && start >= 0 ? start : 0;
    const c = Number.isInteger(count) && count > 0 && count <= 30 ? count : 15;
    return scrapeSteamTopSellersPage(s, c);
});

ipcMain.handle('fetch-gamelist-category', async (event, category, start, count) => {
    const normalizedCategory = String(category || '').trim();
    const tagId = GAMELIST_POPULAR_CATEGORY_TAGS[normalizedCategory];
    if (!tagId) {
        return { success: false, games: [], hasMore: false, nextStart: 0, message: 'Invalid category.' };
    }

    const s = Number.isInteger(start) && start >= 0 ? start : 0;
    const c = Number.isInteger(count) && count > 0 && count <= 30 ? count : 15;
    return scrapeSteamTopSellersPage(s, c, tagId);
});


async function findSteamPath() { // This function's paths are internal, not logged by it
    if (process.platform === 'win32') {
        const keysToTry = [ { key: 'HKCU\\Software\\Valve\\Steam', valueName: 'SteamPath' }, { key: 'HKLM\\SOFTWARE\\Valve\\Steam', valueName: 'InstallPath' }, { key: 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', valueName: 'InstallPath' }];
        for (const item of keysToTry) { try { const o = execSync(`reg query "${item.key}" /v ${item.valueName}`,{encoding:'utf8',stdio:['ignore','pipe','ignore']}); const m=o.match(new RegExp(`${item.valueName}\\s+REG_SZ\\s+(.+)\\s*$`)); if(m?.[1]){const p=m[1].trim();if(fs.existsSync(path.join(p,'steam.exe')))return p;}}catch(e){/*silent fail*/}}
        const dP=['C:\\Program Files (x86)\\Steam','C:\\Program Files\\Steam']; for(const p of dP)if(fs.existsSync(path.join(p,'steam.exe')))return p; return null;
    } else if (process.platform === 'darwin') {
        const dataPath = path.join(os.homedir(), 'Library/Application Support/Steam'); if (fs.existsSync(dataPath)) return dataPath;
        const appPath = '/Applications/Steam.app'; if(fs.existsSync(appPath)) return appPath; return null;
    } else if (process.platform === 'linux') {
        const cD = [path.join(os.homedir(),'.steam/steam'),path.join(os.homedir(),'.local/share/Steam'),path.join(os.homedir(),'.steam/root')];
        for(const d of cD) if(fs.existsSync(path.join(d,'steam.sh'))||fs.existsSync(path.join(d,'steamapps'))) return d;
        try{const p=execSync('which steam',{encoding:'utf8',stdio:'pipe'}).trim(); if(p&&fs.existsSync(p)){ const rp=fs.realpathSync(p);let sD=path.dirname(rp); for(let i=0;i<3;i++){if(fs.existsSync(path.join(sD,'steamapps'))||(path.basename(sD).toLowerCase()==='steam'&&fs.existsSync(path.join(sD,'steam.sh'))))return sD; if(sD===path.dirname(sD))break; sD=path.dirname(sD);}return path.dirname(rp);}}catch(e){/*silent fail*/} return null;
    } return null;
}
async function isSteamRunning() {
    try { // Commands are standard, not exposing sensitive local info
        if (process.platform === 'win32') return execSync('tasklist /NH /FI "IMAGENAME eq steam.exe"',{encoding:'utf8'}).toLowerCase().includes('steam.exe');
        else if (process.platform === 'darwin') return execSync('ps aux | grep "[S]team.app/Contents/MacOS/steam"',{encoding:'utf8'}).trim()!=='';
        else if (process.platform === 'linux') return execSync('pgrep -af steam',{encoding:'utf8'}).toLowerCase().includes('steam');
    } catch (e) { return false; } return false;
}
async function killSteamProcesses() {
    let s=false;
    try{ // Commands are standard
        if(process.platform==='win32'){execSync('taskkill /F /IM steam.exe /T',{stdio:'ignore'});s=true;}
        else if(process.platform==='darwin'){execSync('pkill -f "Steam.app/Contents/MacOS/steam$"',{stdio:'ignore'});await new Promise(r=>setTimeout(r,200));execSync('pkill -f "Steam Helper"',{stdio:'ignore'});s=true;}
        else if(process.platform==='linux'){execSync('pkill -f steam',{stdio:'ignore'});s=true;}
    }catch(e){
        if((e.message?.toLowerCase().includes('process')&&e.message?.toLowerCase().includes('not found'))||e.status===1) {
            s=true;
            sendStatus('Game platform was not running or already closed.', 'info');
        } else {
            console.warn("Process Execution Error: Problem trying to close game platform."); // Generic
            sendStatus(`Error trying to close game platform.`, 'error');
        }
    }
    return s;
}
async function startSteamProcess() {
    let steamExeToStart; // Internal path, not logged
    if (process.platform === 'win32') {
        if (!detectedSteamPath || !fs.existsSync(path.join(detectedSteamPath, 'steam.exe'))) { sendStatus('Game platform path invalid or executable not found. Cannot start', 'error'); return false; }
        steamExeToStart = path.join(detectedSteamPath, 'steam.exe');
        try { spawn(steamExeToStart, [], { detached: true, stdio: 'ignore' }).unref(); }
        catch (e) { console.warn("Process Execution Error: Could not spawn game platform process (Win)."); sendStatus("Failed to start game platform.", "error"); return false; }
    } else if (process.platform === 'darwin') {
        const steamAppLocations = ['/Applications/Steam.app']; // Standard path
        if (detectedSteamPath && detectedSteamPath.endsWith('.app') && fs.existsSync(detectedSteamPath)) steamAppLocations.unshift(detectedSteamPath);
        const appPathToOpen = steamAppLocations.find(p => p && fs.existsSync(p));
        if (appPathToOpen) {
            try { spawn('open', ['-a', appPathToOpen], { detached: true, stdio: 'ignore' }).unref(); }
            catch (e) { console.warn("Process Execution Error: Could not spawn game platform process (macOS)."); sendStatus("Failed to start game platform.", "error"); return false; }
        }
        else { sendStatus('Game platform application not found. Cannot start.', 'error'); return false; }
    } else if (process.platform === 'linux') {
        if (!detectedSteamPath) { sendStatus('Game platform path not detected (Linux). Cannot start', 'error'); return false; }
        let steamLauncher = path.join(detectedSteamPath, 'steam.sh'); // Standard script name
        if (!fs.existsSync(steamLauncher)) steamLauncher = path.join(detectedSteamPath, 'steam');

        if (fs.existsSync(steamLauncher)) {
            try {
                if (process.platform === 'linux') {
                    try { await fsPromises.access(steamLauncher, fs.constants.X_OK); }
                    catch (accessErr) {
                         console.warn(`Game platform launcher not executable. Attempting to change permissions.`); // Generic
                         try { await fsPromises.chmod(steamLauncher, 0o755); }
                         catch (chmodErr) {
                             console.warn(`Failed to make game platform launcher executable.`); // Generic
                             sendStatus('Game platform launcher found but could not be made executable.', 'error');
                             return false;
                         }
                    }
                }
                spawn(steamLauncher, [], { detached: true, stdio: 'ignore' }).unref();
            }
            catch (e) {
                console.warn("Process Execution Error: Could not spawn game platform process from detected path (Linux).");
                sendStatus("Failed to start game platform.", "error");
                return false;
            }
        }
        else {
            try {
                execSync('which steam', { stdio: 'ignore' }); // Standard command
                spawn('steam', [], { detached: true, stdio: 'ignore' }).unref();
            }
            catch (e) {
                sendStatus('Game platform executable not found in detected path or system PATH', 'error');
                return false;
            }
        }
    } else {
        sendStatus(`Game platform control not supported on this OS: ${process.platform}`, 'warning');
        return false;
    }
    return true;
}

ipcMain.handle('check-steam-status', async () => ({ isRunning: await isSteamRunning() }));
ipcMain.handle('start-steam', async () => { sendStatus('Starting game platform', 'info'); const s = await startSteamProcess(); if(s)sendStatus('Game platform start issued', 'success'); return { success:s }; });
ipcMain.handle('restart-steam', async () => { sendStatus('Restarting game platform', 'info'); const k = await killSteamProcesses(); if(!k && await isSteamRunning())sendStatus('Could not close game platform','warning'); await new Promise(r=>setTimeout(r,k?2500:1000)); const s = await startSteamProcess(); if(s)sendStatus('Game platform restart issued', 'success'); return { success:s }; });

ipcMain.handle('install-steam-game', async (event, appId) => {
    if (!isAuthenticated) return { success: false, message: 'Please log in first.' };
    const appIdStr = String(appId || '').trim();
    if (!/^\d+$/.test(appIdStr)) return { success: false, message: 'Invalid AppID.' };

    try {
        await shell.openExternal(`steam://install/${appIdStr}`);
        sendStatus(`Opening Steam install prompt for AppID ${appIdStr}.`, 'info');
        return { success: true };
    } catch (error) {
        sendStatus(`Could not open Steam install prompt for AppID ${appIdStr}.`, 'error');
        return { success: false, message: 'Could not open Steam.' };
    }
});

ipcMain.handle('uninstall-steam-game', async (event, appId) => {
    if (!isAuthenticated) return { success: false, message: 'Please log in first.' };
    const appIdStr = String(appId || '').trim();
    if (!/^\d+$/.test(appIdStr)) return { success: false, message: 'Invalid AppID.' };

    try {
        await shell.openExternal(`steam://uninstall/${appIdStr}`);
        sendStatus(`Opening Steam uninstall prompt for AppID ${appIdStr}.`, 'info');
        return { success: true };
    } catch (error) {
        sendStatus(`Could not open Steam uninstall prompt for AppID ${appIdStr}.`, 'error');
        return { success: false, message: 'Could not open Steam.' };
    }
});

ipcMain.handle('launch-steam-game', async (event, appId) => {
    if (!isAuthenticated) return { success: false, message: 'Please log in first.' };
    const appIdStr = String(appId || '').trim();
    if (!/^\d+$/.test(appIdStr)) return { success: false, message: 'Invalid AppID.' };

    try {
        await shell.openExternal(`steam://run/${appIdStr}`);
        sendStatus(`Opening Steam play prompt for AppID ${appIdStr}.`, 'info');
        return { success: true };
    } catch (error) {
        sendStatus(`Could not open Steam play prompt for AppID ${appIdStr}.`, 'error');
        return { success: false, message: 'Could not open Steam.' };
    }
});

ipcMain.on('handle-dropped-file-data', async (event, droppedFileItems) => {
    if (!isAuthenticated) {
        forceLogoutTamperDetected();
        return; // Kills the file drop!
    }
    if (!Array.isArray(droppedFileItems) || droppedFileItems.length === 0) {
        sendStatus('Drop: No valid file items received for processing.', 'warning');
        return;
    }
    const steamConfigDirInternal = getSteamConfigPath();
    if (!steamConfigDirInternal) {
        sendStatus('Drop Error: Game platform config path not detected. Cannot place files.', 'error');
        return;
    }

    // --- START OF MODIFIED SECTION ---
    const steamRootDirInternal = path.dirname(steamConfigDirInternal);
    const stplugInDirInternal = path.join(steamConfigDirInternal, 'stplug-in');
    const depotCacheDirInternal = path.join(steamRootDirInternal, 'depotcache');
    // --- END OF MODIFIED SECTION ---
    let luaC = 0, manC = 0, othrFail = 0, processedZipSuccessfully = false;

    try {
        await fsPromises.mkdir(stplugInDirInternal, { recursive: true });
        await fsPromises.mkdir(depotCacheDirInternal, { recursive: true });

        for (const item of droppedFileItems) {
            if (!item?.name) {
                othrFail++;
                sendStatus(`Drop Warning: Received an item without a name. Skipping.`, 'warning');
                continue;
            }
            const fN = item.name;
            let procOK = false;

            if (fN.toLowerCase().endsWith('.lua')) {
                const tP = path.join(stplugInDirInternal, fN);
                try {
                    if (item.buffer) {
                        await fsPromises.writeFile(tP, Buffer.from(item.buffer));
                    } else if (item.path) {
                        await fsPromises.copyFile(item.path, tP);
                    } else {
                        throw new Error('No data (buffer or path) provided for LUA file');
                    }
                    luaC++; procOK = true;
                } catch (e) {
                    console.warn(`File System Error (Drop LUA): Problem placing '${fN}'. Error: ${e.message}`);
                    sendStatus(`Drop Error: Failed to place LUA file '${fN}'. Reason: ${e.code || e.message}. Check permissions.`, 'error');
                }
            } else if (fN.toLowerCase().endsWith('.manifest')) {
                const tP = path.join(depotCacheDirInternal, fN);
                try {
                    if (item.buffer) {
                        await fsPromises.writeFile(tP, Buffer.from(item.buffer));
                    } else if (item.path) {
                        await fsPromises.copyFile(item.path, tP);
                    } else {
                        throw new Error('No data (buffer or path) provided for MANIFEST file');
                    }
                    manC++; procOK = true;
                } catch (e) {
                    console.warn(`File System Error (Drop Manifest): Problem placing '${fN}'. Error: ${e.message}`);
                    sendStatus(`Drop Error: Failed to place MANIFEST file '${fN}'. Reason: ${e.code || e.message}. Check permissions.`, 'error');
                }
            } else if (fN.toLowerCase().endsWith('.zip')) {
                sendStatus(`Drop: Processing ZIP archive '${fN}'...`, 'info');
                let zipDataSourcePath = item.path; // Might be null if only buffer was sent
                let tempZipPathToDelete = null;
                const tempExtractPathInternal = path.join(os.tmpdir(), `app-drop-zip-${Date.now()}-${sanitizeFilename(fN)}`);

                try {
                    if (item.buffer) { // If buffer is available, write it to a temp file
                        tempZipPathToDelete = path.join(os.tmpdir(), `temp-drop-buffer-${Date.now()}-${sanitizeFilename(fN)}`);
                        await fsPromises.writeFile(tempZipPathToDelete, Buffer.from(item.buffer));
                        zipDataSourcePath = tempZipPathToDelete; // Use this temp file as the source for AdmZip
                    }

                    if (!zipDataSourcePath || !fs.existsSync(zipDataSourcePath)) {
                        throw new Error(`ZIP file source '${zipDataSourcePath || 'unknown'}' is invalid or inaccessible.`);
                    }

                    await fsPromises.mkdir(tempExtractPathInternal, { recursive: true });
                    await extractZip(zipDataSourcePath, { dir: tempExtractPathInternal });

                    const lF = await findFilesRecursive(tempExtractPathInternal, '.lua');
                    for (const f of lF) {
                        const baseName = path.basename(f);
                        await fsPromises.copyFile(f, path.join(stplugInDirInternal, baseName));
                        luaC++; 
                    }
                    const mF = await findFilesRecursive(tempExtractPathInternal, '.manifest');
                    for (const f of mF) {
                        const baseName = path.basename(f);
                        await fsPromises.copyFile(f, path.join(depotCacheDirInternal, baseName));
                        manC++; 
                    }

                    if (lF.length > 0 || mF.length > 0) {
                        procOK = true;
                        processedZipSuccessfully = true; // Mark that at least one ZIP was processed with content
                    } else {
                        sendStatus(`Drop: No relevant files found inside ZIP '${fN}'.`, 'info');
                    }
                } catch (e) {
                    console.warn(`Archive Processing Error (Drop ZIP): Problem processing '${fN}'. Error: ${e.message}`);
                    sendStatus(`Drop Error: Failed to process ZIP archive '${fN}'. It might be corrupted, password-protected, or inaccessible. Details: ${e.code || e.message}`, 'error');
                } finally {
                    if (fs.existsSync(tempExtractPathInternal)) {
                        try { await fsPromises.rm(tempExtractPathInternal, { recursive: true, force: true }); } catch (_) { /* silent cleanup fail */ }
                    }
                    if (tempZipPathToDelete && fs.existsSync(tempZipPathToDelete)) { // Only delete if we created it from a buffer
                        try { await fsPromises.unlink(tempZipPathToDelete); } catch (_) { /* silent cleanup fail */ }
                    }
                }
            }

            if (!procOK && (fN.toLowerCase().endsWith('.lua') || fN.toLowerCase().endsWith('.manifest') || fN.toLowerCase().endsWith('.zip'))) {
                othrFail++; // Count failures for relevant file types
            }
        }

        if (luaC > 0 || manC > 0) { // This condition means at least one .lua or .manifest was directly placed or extracted
            sendStatus('Game files placed successfully!', 'success');
        } else if (othrFail > 0) { // Relevant files were attempted but failed
            sendStatus('Drop: Some files could not be processed. Check logs for errors.', 'error');
        } else if (droppedFileItems.length > 0 && !processedZipSuccessfully) { // Items were dropped, but none were lua/manifest, or ZIPs had no relevant content
            sendStatus('Drop: No .lua or .manifest files were found in the dropped items or their archives.', 'warning');
        }
    } catch (e) {
        console.warn("Application Error (Drop Handler): Critical issue during file drop preparation (e.g., creating target directories). Error: " + e.message);
        sendStatus(`Drop Error: Critical problem during file drop setup. Reason: ${e.code || e.message}`, 'error');
    }
});

ipcMain.on('open-external-url', (event, url) => { // URL is from UI, but shell.openExternal is standard
    if (url?.startsWith('http')) shell.openExternal(url).catch(err => {
        console.warn(`Shell Operation Error: Could not open external URL.`); // Generic
        sendStatus(`Link error: Could not open the requested link.`, 'error');
    });
    else sendStatus(`Invalid URL provided for external link.`, 'warning'); // Generic
});

ipcMain.on('open-steam-config-folder', async () => {
    if (!isUserPremium) { sendStatus('Open Folder is a premium feature.', 'warning'); return; }
    const cPInternal = getSteamConfigPath(); // Internal path
    if (cPInternal) {
        if (!fs.existsSync(cPInternal)) try { await fsPromises.mkdir(cPInternal, { recursive: true }); } catch (e) {
            console.warn("File System Error: Could not create folder for opening."); // Generic
            sendStatus("Error preparing folder.", "error");
            return;
        }
        try { await shell.openPath(cPInternal); sendStatus(`Configuration folder opened.`, 'info'); } // Generic
        catch (err) {
            console.warn(`Shell Operation Error: Problem opening folder path.`); // Generic
            sendStatus(`Error opening game platform configuration folder.`, 'error');
        }
    } else { sendStatus('Game platform config path not found', 'warning'); }
});

ipcMain.on('wipe-steamtools-data', async () => {
    if (!isUserPremium) { sendStatus('Wipe Game Platform Data is a premium feature.', 'warning'); return; }
    const steamConfigDirInternal = getSteamConfigPath();
    if (!steamConfigDirInternal) { sendStatus('Game platform config path not detected. Cannot wipe data.', 'error'); return; }
    
    // --- START OF MODIFIED SECTION ---
    const steamRootDirInternal = path.dirname(steamConfigDirInternal);
    const depotCacheDirInternal = path.join(steamRootDirInternal, 'depotcache'); // Now targets Steam/depotcache
    const stplugInDirInternal = path.join(steamConfigDirInternal, 'stplug-in');
    // --- END OF MODIFIED SECTION ---

    try {
        if (fs.existsSync(depotCacheDirInternal)) { await fsPromises.rm(depotCacheDirInternal, { recursive: true, force: true }); }
        if (fs.existsSync(stplugInDirInternal)) {
            const items = await fsPromises.readdir(stplugInDirInternal);
            for (const item of items) {
                const itemPathInternal = path.join(stplugInDirInternal, item); // Internal path
                // Filenames are okay for comparison if they are specific app internal files
                if (item.toLowerCase() !== STEAMTOOLS_LUA_FILENAME_INTERNAL.toLowerCase() && item.toLowerCase() !== 'luapacka.exe') {
                    await fsPromises.rm(itemPathInternal, { recursive: true, force: true });
                }
            }
        }
        sendStatus('Game platform data wipe process completed.', 'success');
    } catch (err) {
        console.warn("File System Error: Problem wiping game platform data."); // Generic
        sendStatus(`Error wiping game platform data.`, 'error');
    }
});

ipcMain.on('fix-steamtools', async () => {
    let stoolsPathInternal; const appDirInternal = app.getAppPath(); // Internal path
    if (app.isPackaged) { stoolsPathInternal = path.join(path.dirname(app.getPath('exe')), 'stools.exe'); } // Filename okay
    else { stoolsPathInternal = path.join(appDirInternal, 'stools.exe'); } // Filename okay
    if (!fs.existsSync(stoolsPathInternal)) { sendStatus(`Required utility not found. Cannot run fix.`, 'error'); return; } // Generic

    if (process.platform === 'win32') {
        const escapedPath = stoolsPathInternal.replace(/'/g, "''"); // Path escaping for command, not logged
        exec(`powershell -Command "Start-Process -FilePath '${escapedPath}' -Verb RunAs"`, (adminLaunchError, stdout, stderr) => {
            if (adminLaunchError) {
                console.warn("Process Execution Warning: Admin launch for fix utility failed or was cancelled."); // Generic
                sendStatus('Admin launch for fix utility failed or was cancelled. Attempting normal launch.', 'warning');
                try {
                    const child = spawn(stoolsPathInternal, [], { detached: true, stdio: 'ignore' });
                    child.on('error', (normalLaunchSpawnError) => {
                        console.warn("Process Execution Error: Normal launch for fix utility also failed."); // Generic
                        sendStatus(`Normal launch for fix utility also failed.`, 'error');
                    });
                    child.unref();
                } catch (syncSpawnError) {
                    console.warn("Process Execution Error: Problem setting up normal launch for fix utility."); // Generic
                    sendStatus(`Error setting up normal launch for fix utility.`, 'error');
                }
            } else { sendStatus('Fix utility admin launch initiated successfully.', 'success'); }
        });
    } else {
        try {
            const child = spawn(stoolsPathInternal, [], { detached: true, stdio: 'ignore' });
            child.on('error', (launchError) => {
                console.warn("Process Execution Error: Fix utility launch failed (non-Windows)."); // Generic
                sendStatus(`Fix utility launch failed (non-Windows).`, 'error');
            });
            child.unref();
            sendStatus(`Fix utility launch initiated (non-Windows). Admin rights may be required manually.`, 'info');
        } catch (syncSpawnError_nonWin) {
             console.warn("Process Execution Error: Problem setting up launch for fix utility (non-Windows)."); // Generic
             sendStatus(`Error setting up launch for fix utility (non-Windows).`, 'error');
        }
    }
});

async function getLocalHardwareId() {
    try {
        return String(machineIdSync({ original: true }) || '').trim();
    } catch (_) {
        return null;
    }
}



async function performAuthentication(isUserSubmission = false) {
    let userAuthCodeFromFile = '';
    let readmeText = await getReadmeText();

    try {
        if (fs.existsSync(AUTH_FILE_PATH_INTERNAL)) {
            userAuthCodeFromFile = fs.readFileSync(AUTH_FILE_PATH_INTERNAL, 'utf8').trim();
        }
    } catch (readError) {
        console.warn("File System Warning: Auth data read problem.");
    }

    if (!userAuthCodeFromFile && !isUserSubmission) {
        if (mainWindow) mainWindow.webContents.send('auth-result', { success: false, message: 'Authentication required', readmeText: readmeText, isPremium: false, expirationInfo: null });
        return false;
    }

    const localHwid = await getLocalHardwareId();

    try {
        const authResponse = await got.post('http://209.46.127.241/api/auth', {
            json: { code: userAuthCodeFromFile, hwid: localHwid },
            timeout: { request: 10000 },
            throwHttpErrors: false
        });

        if (authResponse.statusCode === 200) {
            const signature = authResponse.headers['x-signature'];
            const data = verifyAndParseResponse(authResponse.body, signature);

            if (data.success && data.user) {
                const status = data.user.status;
                const isPremium = status === 'premium' || status === 'trial';
                let expirationDisplayInfo = status === 'trial' ? `${data.user.trial_days} Days` : 'Lifetime';

                if (status === 'free') {
                    expirationDisplayInfo = null; // Free app doesn't show expiration
                }

                await postAuthSetup(isPremium, expirationDisplayInfo, status, data.user.trial_days);
                
                let guestCode = null;
                if (data.user.code === 'fomiopalma') {
                    // Derive a persistent guest code from the stable HWID
                    const shortHash = crypto.createHash('md5').update(localHwid).digest('hex').substring(0, 6).toUpperCase();
                    guestCode = `guest-${shortHash}`;
                }

                // Inform frontend of auth success and user code
                if (mainWindow) mainWindow.webContents.send('auth-result', { 
                    success: true, 
                    isPremium: isPremium, 
                    expirationInfo: expirationDisplayInfo,
                    userCode: data.user.code,
                    guestCode: guestCode,
                    userStatus: status,
                    trialDays: data.user.trial_days
                });
                return true;
            } else {
                if (mainWindow) mainWindow.webContents.send('auth-result', { 
                    success: false, 
                    message: data.message || 'Authentication failed', 
                    readmeText: readmeText, 
                    isPremium: false, 
                    expirationInfo: null,
                    device_mismatch: data.device_mismatch || false
                });
                return false;
            }
        } else {
            if (mainWindow) mainWindow.webContents.send('auth-result', { success: false, message: 'Server error during authentication.', readmeText: readmeText, isPremium: false, expirationInfo: null });
            return false;
        }

    } catch (e) {
        console.warn("Network Error: Validation failed.", e);
        if (mainWindow) mainWindow.webContents.send('auth-result', { success: false, message: 'Authentication failed: API connection error.', readmeText: readmeText, isPremium: false, expirationInfo: null });
        return false;
    }
}

async function mainWorkflow(steamIdForWorkflow, forceAutoSaveFromLibrary = false, forceSource6Only = false) {
    const originalCurrentGameName = currentGameName;
    currentGameName = `AppID: ${steamIdForWorkflow}`;

    const drmCheckResult = await checkDrm(steamIdForWorkflow, false); // Returns sanitized errors

    const isDefinitelyInvalidAppId = ['invalid_api', 'invalid_store'].includes(drmCheckResult.status);
    const otherCriticalFailure = ['failed_http_store', 'failed_store_scrape', 'invalid', 'failed', 'unknown_error', 'api_error', 'store_invalid', 'store_error', 'coming_soon'].includes(drmCheckResult.status);

    if (isDefinitelyInvalidAppId) {
        currentGameName = originalCurrentGameName;
        return false;
    }
    if (otherCriticalFailure) {
        if (drmCheckResult.status !== 'coming_soon') {
            sendStatus(`Critical error or game not available for AppID ${steamIdForWorkflow}. Cannot proceed.`, 'error');
        }
        currentGameName = originalCurrentGameName;
        return false;
    }

    if (drmCheckResult.status === 'drm_found') {
        sendStatus(`GAME IS NOT PLAYABLE`, 'error');
    } else if (drmCheckResult.status === 'age_restricted' || drmCheckResult.status === 'region_locked') {
        sendStatus(`GAME HAS AVAILABILITY RESTRICTIONS`, 'error'); // Generic
    }

    let success = false;
    try {
        // Prioritize Source 1 (Premium GitHub repo). Fall back to Source 2, then Source 6 if it fails.
        sendStatus(`Preparing download for ${currentGameName} from Source 1`);
        try {
            success = await downloadFromGamepriv(steamIdForWorkflow, forceAutoSaveFromLibrary);
        } catch (s1Error) {
            console.warn(`Application Error: Source 1 download failed for AppID ${steamIdForWorkflow}.`); // Generic
            success = false;
        }
        if (!success) {
            sendStatus(`Source 1 unavailable — trying fallback Source 2 for ${currentGameName}`, 'warning');
            try {
                success = await downloadFromDepotbox(steamIdForWorkflow, forceAutoSaveFromLibrary);
            } catch (dbError) {
                console.warn(`Application Error: Source 2 download failed for AppID ${steamIdForWorkflow}.`);
                success = false;
            }
        }
        if (!success) {
            sendStatus(`Source 2 unavailable — trying fallback Source 6 for ${currentGameName}`, 'warning');
            success = await downloadFromSource6(steamIdForWorkflow, forceAutoSaveFromLibrary);
        }
    } catch (error) {
        console.warn(`Application Error: Unexpected issue in download workflow for AppID ${steamIdForWorkflow}`); // Generic
        sendStatus(`Download workflow error for game (AppID ${steamIdForWorkflow}).`, 'error');
        success = false;
    }

    currentGameName = originalCurrentGameName;
    return success;
}

// ===========================================================================
// =============== MERGED MODULES (GameZoneQA Ultimate) =======================
// All channels are namespaced (drm-/gl-/sw-) so they never collide with the
// premiumLua handlers above. Each module keeps its own private state.
// ===========================================================================

// Generic external-link opener shared by the Game/Software library modules.
ipcMain.handle('app-open-external', async (event, url) => {
    try { await shell.openExternal(url); return { success: true }; }
    catch (e) { return { success: false }; }
});

// The music website runs in a sandboxed BrowserView with its own persistent sign-in session.
ipcMain.handle('youtube-music-view', async (event, request = {}) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return { success: false };
    const bounds = request && request.bounds ? request.bounds : {};
    if (request.visible !== true) {
        if (youtubeMusicBrowserView && youtubeMusicBrowserViewAttached) {
            try { mainWindow.removeBrowserView(youtubeMusicBrowserView); } catch (_) {}
            youtubeMusicBrowserViewAttached = false;
        }
        return { success: true };
    }
    const size = mainWindow.getContentSize();
    const x = Math.max(0, Math.floor(Number(bounds.x) || 0));
    const y = Math.max(0, Math.floor(Number(bounds.y) || 0));
    const width = Math.max(0, Math.min(size[0] - x, Math.floor(Number(bounds.width) || 0)));
    const height = Math.max(0, Math.min(size[1] - y, Math.floor(Number(bounds.height) || 0)));
    youtubeMusicLastBounds = { x, y, width, height };
    if (width < 80 || height < 80) return { success: false, message: 'The music page area is too small.' };

    if (!youtubeMusicBrowserView) {
        const musicSession = session.fromPartition('persist:gamezoneqa-youtube-music');
        if (!youtubeMusicAdBlockInstalled) {
            const blockedAdHosts = [
                'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
                'ad.youtube.com', 'ads.youtube.com', 'adnxs.com', 'adsrvr.org', 'criteo.com',
                'taboola.com', 'outbrain.com', 'amazon-adsystem.com', 'adform.net', 'pubmatic.com',
                'openx.net', 'bidswitch.net', 'smartadserver.com', 'moatads.com', 'zedo.com', '2mdn.net'
            ];
            musicSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
                let blocked = false;
                try {
                    const host = new URL(details.url).hostname.toLowerCase();
                    blocked = blockedAdHosts.some((domain) => host === domain || host.endsWith('.' + domain));
                } catch (_) {}
                callback({ cancel: blocked });
            });
            youtubeMusicAdBlockInstalled = true;
        }        youtubeMusicBrowserView = new BrowserView({ webPreferences: {
            partition: 'persist:gamezoneqa-youtube-music',
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        } });
        youtubeMusicBrowserView.webContents.on('console-message', (event, level, message) => { if (String(message).startsWith('[GZ-MUSIC]')) console.log(message); });
        youtubeMusicBrowserView.webContents.on('enter-html-full-screen', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('youtube-music-fullscreen-state', true); });
        youtubeMusicBrowserView.webContents.on('leave-html-full-screen', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('youtube-music-fullscreen-state', false); });
        // Hide the left and right YouTube Music header groups, leaving search and page content visible
        // inside this BrowserView only; the GameZone UI remains untouched.
        youtubeMusicBrowserView.webContents.on('did-finish-load', () => {
            youtubeMusicBrowserView.webContents.executeJavaScript(`(() => {
                const scrollbarStyledRoots = new WeakSet();
                const addScrollbarHiding = (root) => {
                    if (scrollbarStyledRoots.has(root)) return;
                    const style = document.createElement('style');
                    style.textContent = ':host, html, body, * { scrollbar-width: none !important; } :host::-webkit-scrollbar, html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; } .ytp-caption-window-container .caption-window, .ytp-caption-window-container .ytp-caption-window-bottom { bottom: calc(8% + 38px) !important; }';
                    if (root === document) (document.head || document.documentElement).appendChild(style);
                    else root.appendChild(style);
                    scrollbarStyledRoots.add(root);
                };


                document.addEventListener('fullscreenchange', () => setTimeout(() => hideAndSyncMusicChrome(), 0), true);
                const musicPageIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 6 5-6z"/></svg>';
                const musicTogglePopupIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5l-9 7 9 7z"/></svg>';
                let musicPopupOpen = false;
                const musicFullscreenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
                const musicExitFullscreenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5"/></svg>';
                const musicIsFullscreen = (roots) => !!document.fullscreenElement || roots.some((root) => root.querySelector('.ytp-fullscreen, ytmusic-player-page[fullscreen], ytmusic-player-page.fullscreen'));
                const musicCurrentPlayerUrl = (roots) => {
                    for (const root of roots) for (const link of root.querySelectorAll('a[href*="/watch"]')) {
                        try { const url = new URL(link.href, location.href); if (url.origin === location.origin && url.pathname.includes('/watch')) return url.href; } catch (_) {}
                    }
                    return location.href;
                };
                const musicExitFullscreen = async (roots) => {
                    if (document.fullscreenElement && document.exitFullscreen) { try { await document.exitFullscreen(); } catch (_) {} return; }
                    for (const root of roots) if (root.querySelector('.ytp-fullscreen, ytmusic-player-page[fullscreen], ytmusic-player-page.fullscreen')) {
                        const button = root.querySelector('button.ytp-fullscreen-button');
                        if (button) { button.click(); return; }
                    }
                };
                const musicSetSvg = (element, svgMarkup) => {
                    const ns = 'http://www.w3.org/2000/svg';
                    const svg = document.createElementNS(ns, 'svg');
                    svg.setAttribute('viewBox', (/viewBox="([^"]+)"/.exec(svgMarkup) || [])[1] || '0 0 24 24');
                    svg.setAttribute('aria-hidden', 'true');
                    const pathData = (/<path d="([^"]+)"/.exec(svgMarkup) || [])[1] || '';
                    const path = document.createElementNS(ns, 'path');
                    path.setAttribute('d', pathData);
                    svg.appendChild(path);
                    element.replaceChildren(svg);
                };
                const musicButton = (container, key, label, icon, large = false) => {
                    let button = container.querySelector('[data-gamezone-music-control="' + key + '"]');
                    if (!button) {
                        button = document.createElement('button');
                        button.type = 'button';
                        button.setAttribute('data-gamezone-music-control', key);
                        button.className = large ? 'ytp-button' : 'gamezone-music-native-button';
                        const boxSize = large ? 48 : 40; button.style.cssText = 'display:grid!important;place-items:center!important;flex:0 0 ' + boxSize + 'px!important;width:' + boxSize + 'px!important;height:' + boxSize + 'px!important;padding:' + (large ? 10 : (key === 'popup' ? 6 : 8)) + 'px!important;border:0!important;border-radius:50%!important;background:transparent!important;color:rgba(255,255,255,.9)!important;cursor:pointer!important;';
                        container.appendChild(button);
                    }
                    button.setAttribute('aria-label', label);
                    button.title = label;
                    if (button.dataset.gamezoneIcon !== icon) { musicSetSvg(button, icon); button.dataset.gamezoneIcon = icon; }
                    const svg = button.querySelector('svg');
                    svg.style.cssText = (key === 'page' || key === 'popup') ?'display:block!important;width:' + (key === 'popup' ? 28 : 22) + 'px!important;height:' + (key === 'popup' ? 28 : 22) + 'px!important;fill:currentColor!important;stroke:none!important;' : 'display:block!important;width:22px!important;height:22px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;';
                    return button;
                };
                const installMusicPlayerControls = (roots) => {
                    const inFullscreen = musicIsFullscreen(roots);
                    let installed = false;
                    const bindPageAction = (button) => {
                        if (button.dataset.gamezoneBound) return;
                        button.dataset.gamezoneBound = '1';
                        button.addEventListener('click', async (event) => {
                            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
                            const playerUrl = musicCurrentPlayerUrl(roots);
                            await musicExitFullscreen(roots);
                            if (playerUrl && playerUrl !== location.href) location.assign(playerUrl);
                        }, true);
                    };
                    const bindFullscreenAction = (button) => {
                        if (button.dataset.gamezoneBound) return;
                        button.dataset.gamezoneBound = '1';
                        button.addEventListener('click', async (event) => {
                            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
                            const native = roots.map((root) => root.querySelector('button.ytp-fullscreen-button')).find(Boolean);
                            if (musicIsFullscreen(roots)) await musicExitFullscreen(roots);
                            else if (native) native.click();
                            else { const target = document.querySelector('ytmusic-player-page') || document.documentElement; try { await target.requestFullscreen?.(); } catch (_) {} }
                        }, true);
                    };
                    const lightBar = document.querySelector('ytmusic-player-bar');
                    const lightRight = lightBar && !lightBar.shadowRoot ? lightBar.querySelector('#right-controls') : null;
                    if (lightRight) {
                        if (!document.querySelector('style[data-gamezone-popup-style]')) {
                            const popupStyle = document.createElement('style');
                            popupStyle.setAttribute('data-gamezone-popup-style', '1');
                            popupStyle.textContent = '#right-controls[data-gamezone-popup] > .right-controls-buttons, #right-controls[data-gamezone-popup] > .volume-slider { display: flex !important; overflow: hidden !important; flex: 0 0 auto !important; box-sizing: border-box !important; transition: max-width .28s ease, opacity .2s ease !important; } '
                                + '#right-controls[data-gamezone-popup="closed"] > .right-controls-buttons, #right-controls[data-gamezone-popup="closed"] > .volume-slider { max-width: 0 !important; min-width: 0 !important; opacity: 0 !important; pointer-events: none !important; margin: 0 !important; padding: 0 !important; } '
                                + '#right-controls[data-gamezone-popup="open"] > .right-controls-buttons { max-width: 240px !important; opacity: 1 !important; } '
                                + '#right-controls[data-gamezone-popup="open"] > .volume-slider { max-width: 110px !important; opacity: 1 !important; } '
                                + '#right-controls[data-gamezone-popup] > .right-controls-buttons .expand-button { display: none !important; }';
                            (document.head || document.documentElement).appendChild(popupStyle);
                        }
                        const group = lightRight.querySelector('[data-gamezone-music-control-group="bar"]') || document.createElement('div');
                        group.setAttribute('data-gamezone-music-control-group', 'bar');
                        group.style.cssText = 'display:flex!important;align-items:center!important;gap:2px!important;flex:0 0 auto!important;margin-right:4px!important;';
                        const popupToggle = musicButton(group, 'popup', 'Show volume, repeat and shuffle', musicTogglePopupIcon);
                        group.querySelector('[data-gamezone-music-control="fullscreen"]')?.remove();
                        if (!group.parentElement) lightRight.insertBefore(group, lightRight.querySelector('.toggle-player-page-button'));
                        popupToggle.style.setProperty('transform', musicPopupOpen ? 'rotate(180deg)' : 'none', 'important');
                        popupToggle.style.setProperty('transition', 'transform .25s ease', 'important');
                        lightRight.setAttribute('data-gamezone-popup', musicPopupOpen ? 'open' : 'closed');
                        if (!lightRight.dataset.gamezoneHover) {
                            lightRight.dataset.gamezoneHover = '1';
                            let popupTimer = null;
                            const openPopup = () => { clearTimeout(popupTimer); if (!musicPopupOpen) { musicPopupOpen = true; hideAndSyncMusicChrome(); } };
                            const closePopupSoon = () => { clearTimeout(popupTimer); popupTimer = setTimeout(() => { musicPopupOpen = false; hideAndSyncMusicChrome(); }, 250); };
                            popupToggle.addEventListener('mouseenter', openPopup);
                            popupToggle.addEventListener('mouseleave', closePopupSoon);
                            popupToggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openPopup(); });
                            for (const selector of ['.right-controls-buttons', '.volume-slider']) {
                                const part = lightRight.querySelector(selector);
                                if (!part) continue;
                                part.addEventListener('mouseenter', openPopup);
                                part.addEventListener('mouseleave', closePopupSoon);
                            }
                        }
                        installed = true;
                    }
                    for (const root of roots) {
                        if (root.host?.localName?.toLowerCase() === 'ytmusic-player-bar') {
                            const right = root.querySelector('#right-controls, .right-controls');
                            if (right) {
                                const group = root.querySelector('[data-gamezone-music-control-group="bar"]') || document.createElement('div');
                                group.setAttribute('data-gamezone-music-control-group', 'bar');
                                group.style.cssText = 'display:flex!important;align-items:center!important;gap:2px!important;flex:0 0 auto!important;margin-left:8px!important;';
                                const popupToggle = musicButton(group, 'popup', 'Show volume, repeat and shuffle', musicTogglePopupIcon);
                                if (group.firstElementChild !== popupToggle) group.insertBefore(popupToggle, group.firstElementChild);
                                popupToggle.style.setProperty('transform', musicPopupOpen ? 'rotate(90deg)' : 'none', 'important');
                                popupToggle.style.setProperty('display', 'grid', 'important');
                                popupToggle.style.setProperty('visibility', 'visible', 'important');
                                if (!popupToggle.dataset.gamezoneBound) {
                                    popupToggle.dataset.gamezoneBound = '1';
                                    let popupCloseTimer = null;
                                    const openPopup = () => { clearTimeout(popupCloseTimer); if (!musicPopupOpen) { musicPopupOpen = true; hideAndSyncMusicChrome(); } };
                                    const closePopupSoon = () => { clearTimeout(popupCloseTimer); popupCloseTimer = setTimeout(() => { musicPopupOpen = false; hideAndSyncMusicChrome(); }, 250); };
                                    popupToggle.addEventListener('mouseenter', openPopup);
                                    popupToggle.addEventListener('mouseleave', closePopupSoon);
                                    popupToggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openPopup(); }, true);
                                    popupToggle.__gzPopupHover = { openPopup, closePopupSoon };
                                }
                                const hoverBox = right.querySelector('.right-controls-buttons');
                                if (hoverBox && !hoverBox.dataset.gamezoneHover && popupToggle.__gzPopupHover) {
                                    hoverBox.dataset.gamezoneHover = '1';
                                    hoverBox.addEventListener('mouseenter', popupToggle.__gzPopupHover.openPopup);
                                    hoverBox.addEventListener('mouseleave', popupToggle.__gzPopupHover.closePopupSoon);
                                }
                                if (!root.querySelector('style[data-gamezone-popup-style]')) {
                                    const popupStyle = document.createElement('style');
                                    popupStyle.setAttribute('data-gamezone-popup-style', '1');
                                    popupStyle.textContent = '.right-controls-buttons[data-gamezone-popup] { display: none !important; } .right-controls-buttons[data-gamezone-popup="open"] { display: flex !important; align-items: center !important; position: absolute !important; right: 12px !important; bottom: 100% !important; margin-bottom: 0 !important; padding: 6px 12px 14px !important; border-radius: 28px !important; background: rgba(32,32,32,.96) !important; box-shadow: 0 4px 18px rgba(0,0,0,.55) !important; z-index: 2147483647 !important; animation: gamezone-popup-in .16s ease-out; } .right-controls-buttons[data-gamezone-popup="open"] .expand-button { display: none !important; } @keyframes gamezone-popup-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }';
                                    root.appendChild(popupStyle);
                                }
                                const controlsBox = right.querySelector('.right-controls-buttons');
                                if (controlsBox) controlsBox.setAttribute('data-gamezone-popup', musicPopupOpen ? 'open' : 'closed');
                                root.host.style.setProperty('overflow', 'visible', 'important');
                                const page = musicButton(group, 'page', 'Open player page', musicPageIcon);
                                const fullscreen = musicButton(group, 'fullscreen', inFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', inFullscreen ? musicExitFullscreenIcon : musicFullscreenIcon);
                                bindPageAction(page); bindFullscreenAction(fullscreen);
                                if (!group.parentElement) right.appendChild(group);
                                right.style.setProperty('overflow', 'visible', 'important');
                                installed = true;
                            }
                        }
                        const videoRight = root.querySelector('.ytp-right-controls');
                        if (videoRight) {
                            const nativeFullscreen = videoRight.querySelector('button.ytp-fullscreen-button');
                            const page = musicButton(videoRight, 'page', 'Exit fullscreen and open player page', musicPageIcon, true);
                            bindPageAction(page);
                            if (nativeFullscreen && page.nextElementSibling !== nativeFullscreen) videoRight.insertBefore(page, nativeFullscreen);
                            const fsToggle = musicButton(videoRight, 'popup', 'Show volume, repeat and shuffle', musicTogglePopupIcon, true);
                            if (page.previousElementSibling !== fsToggle) videoRight.insertBefore(fsToggle, page);
                            fsToggle.style.setProperty('visibility', 'visible', 'important');
                            const playerBox = videoRight.closest('.html5-video-player') || videoRight.parentElement;
                            let fsPop = playerBox.querySelector('[data-gamezone-fs-popup]');
                            if (!fsPop) {
                                fsPop = document.createElement('div');
                                fsPop.setAttribute('data-gamezone-fs-popup', '1');
                                fsPop.style.cssText = 'display:none;align-items:center;gap:8px;position:absolute;right:12px;bottom:56px;padding:8px 14px 12px;border-radius:28px;background:rgba(32,32,32,.96);box-shadow:0 4px 18px rgba(0,0,0,.55);z-index:2147483647;color:#fff;';
                                const nativeBar = () => document.querySelector('ytmusic-player-bar')?.shadowRoot || document.querySelector('ytmusic-player-bar');
                                const icons = {
                                    repeat: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
                                    shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>'
                                };
                                const slider = document.createElement('input');
                                slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.title = 'Volume';
                                slider.style.cssText = 'width:100px;cursor:pointer;accent-color:#fff;';
                                slider.addEventListener('input', () => {
                                    const video = document.querySelector('video');
                                    if (video) { video.muted = false; video.volume = Number(slider.value) / 100; }
                                });
                                fsPop.appendChild(slider);
                                for (const key of ['repeat', 'shuffle']) {
                                    const b = document.createElement('button');
                                    b.type = 'button'; b.title = key === 'repeat' ? 'Repeat' : 'Shuffle';
                                    musicSetSvg(b, icons[key]);
                                    b.style.cssText = 'display:grid;place-items:center;width:36px;height:36px;padding:7px;border:0;border-radius:50%;background:transparent;color:rgba(255,255,255,.9);cursor:pointer;';
                                    b.firstElementChild.style.cssText = 'width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;';
                                    b.addEventListener('click', (event) => {
                                        event.stopPropagation();
                                        const target = nativeBar()?.querySelector('.' + key);
                                        if (target) target.click();
                                    });
                                    fsPop.appendChild(b);
                                }
                                let fsTimer = null;
                                const fsOpen = () => {
                                    clearTimeout(fsTimer);
                                    const video = document.querySelector('video');
                                    if (video) slider.value = String(Math.round((video.muted ? 0 : video.volume) * 100));
                                    fsPop.style.display = 'flex';
                                    fsToggle.style.setProperty('transform', 'rotate(90deg)', 'important');
                                };
                                const fsCloseSoon = () => {
                                    clearTimeout(fsTimer);
                                    fsTimer = setTimeout(() => { fsPop.style.display = 'none'; fsToggle.style.setProperty('transform', 'none', 'important'); }, 250);
                                };
                                fsToggle.addEventListener('mouseenter', fsOpen);
                                fsToggle.addEventListener('mouseleave', fsCloseSoon);
                                fsPop.addEventListener('mouseenter', fsOpen);
                                fsPop.addEventListener('mouseleave', fsCloseSoon);
                                fsToggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); fsOpen(); }, true);
                                playerBox.appendChild(fsPop);
                            }
                        }
                    }
                    if (!installed) {const bar = document.querySelector('ytmusic-player-bar');
                        if (bar) {
                            bar.style.setProperty('box-sizing', 'border-box', 'important');
                            bar.style.setProperty('padding-right', '92px', 'important');
                        }
                        const group = document.documentElement.querySelector('[data-gamezone-music-control-group="fallback"]') || document.createElement('div');
                        group.setAttribute('data-gamezone-music-control-group', 'fallback');
                        group.style.cssText = 'position:fixed!important;right:8px!important;bottom:24px!important;z-index:2147483647!important;display:flex!important;align-items:center!important;gap:2px!important;padding:2px!important;border-radius:26px!important;background:rgba(32,32,32,.82)!important;pointer-events:auto!important;';
                        const page = musicButton(group, 'page', 'Open player page', musicPageIcon);
                        const fullscreen = musicButton(group, 'fullscreen', inFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', inFullscreen ? musicExitFullscreenIcon : musicFullscreenIcon);
                        bindPageAction(page); bindFullscreenAction(fullscreen);
                        if (!group.parentElement) document.documentElement.appendChild(group);
                        installed = true;
                    }                    return installed;
                };                const adSelectors = 'ytmusic-ad-slot-renderer, ytmusic-promoted-sparkles-web-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer, .ytp-ad-module, .ytp-ad-overlay-container, .ytp-ad-image-overlay, .video-ads';
                const hideMusicAds = () => {
                    const roots = [document];
                    const seen = new Set();
                    while (roots.length) {
                        const root = roots.pop();
                        if (!root || seen.has(root)) continue;
                        seen.add(root);
                        addScrollbarHiding(root);
                        for (const node of root.querySelectorAll('*')) {
                            if (node.shadowRoot) roots.push(node.shadowRoot);
                            if (node.matches(adSelectors) || node.matches('#left-content, #right-content')) node.style.setProperty('display', 'none', 'important');
                        }

                    }
                };
                const hideAndSyncMusicChrome = () => {
                    const roots = [document];
                    const seen = new Set();
                    while (roots.length) {
                        const root = roots.pop();
                        if (!root || seen.has(root)) continue;
                        seen.add(root);
                        addScrollbarHiding(root);
                        for (const node of root.querySelectorAll('*')) {
                            if (node.shadowRoot) roots.push(node.shadowRoot);
                            if (node.matches(adSelectors) || node.matches('#left-content, #right-content')) node.style.setProperty('display', 'none', 'important');
                        }
                    }
                    try { return installMusicPlayerControls(Array.from(seen)); }
                    catch (error) { console.error('[GZ-MUSIC] install failed: ' + (error && error.stack || error)); return false; }
                };
                const hasNativeMusicControls = hideAndSyncMusicChrome();
                new MutationObserver(hideAndSyncMusicChrome).observe(document.documentElement, { childList: true, subtree: true });
                setInterval(hideAndSyncMusicChrome, 1000);
                return hasNativeMusicControls;
            })()`).then((hasNativeMusicControls) => {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('youtube-music-inline-controls-state', !!hasNativeMusicControls);
            }).catch((error) => console.warn('YouTube Music controls injection failed:', error.message));
        });        youtubeMusicBrowserView.webContents.setWindowOpenHandler(({ url }) => {
            if (/^https:\/\/accounts\.google\.com\//i.test(url)) shell.openExternal(url).catch(() => {});
            else if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
            return { action: 'deny' };
        });
        youtubeMusicBrowserView.webContents.on('will-navigate', (navigationEvent, url) => {
            if (/^https:\/\/accounts\.google\.com\//i.test(url)) {
                navigationEvent.preventDefault();
                shell.openExternal(url).catch(() => {});
            } else if (!/^https?:\/\//i.test(url)) navigationEvent.preventDefault();
        });
        youtubeMusicBrowserView.webContents.loadURL('https://music.youtube.com').catch(() => {});
    }
    if (!youtubeMusicBrowserViewAttached) {
        mainWindow.addBrowserView(youtubeMusicBrowserView);
        youtubeMusicBrowserViewAttached = true;
    }
    refreshYouTubeMusicViewBounds();
    return { success: true };
});

ipcMain.handle('youtube-music-control', async (event, action) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || !youtubeMusicBrowserView) return { success: false };
    const contents = youtubeMusicBrowserView.webContents;
    if (action === 'back' && contents.canGoBack()) contents.goBack();
    else if (action === 'forward' && contents.canGoForward()) contents.goForward();
    else if (action === 'reload') contents.reload();
    else if (action === 'player-page') {
        await contents.executeJavaScript(`(async () => {
            const roots = [document];
            const seen = new Set();
            let playerUrl = '';
            while (roots.length) {
                const root = roots.pop();
                if (!root || seen.has(root)) continue;
                seen.add(root);
                for (const link of root.querySelectorAll('a[href*="/watch"]')) {
                    try { const url = new URL(link.href, location.href); if (url.origin === location.origin && url.pathname.includes('/watch')) { playerUrl = url.href; break; } } catch (_) {}
                }
                if (playerUrl) break;
                for (const node of root.querySelectorAll('*')) if (node.shadowRoot) roots.push(node.shadowRoot);
            }
            if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
            else {
                for (const root of seen) {
                    if (root.querySelector('.ytp-fullscreen, ytmusic-player-page[fullscreen], ytmusic-player-page.fullscreen')) {
                        const exitButton = root.querySelector('button.ytp-fullscreen-button');
                        if (exitButton) { exitButton.click(); break; }
                    }
                }
            }
            if (playerUrl && playerUrl !== location.href) location.assign(playerUrl);
            return Boolean(playerUrl);
        })()`);
    } else if (action === 'fullscreen') {
        await contents.executeJavaScript(`(() => {
            if (document.fullscreenElement) { document.exitFullscreen?.(); return true; }
            const roots = [document];
            const seen = new Set();
            while (roots.length) {
                const root = roots.pop();
                if (!root || seen.has(root)) continue;
                seen.add(root);
                const button = root.querySelector('button.ytp-fullscreen-button');
                if (button) { button.click(); return true; }
                for (const node of root.querySelectorAll('*')) if (node.shadowRoot) roots.push(node.shadowRoot);
            }
            const target = document.querySelector('ytmusic-player-page') || document.documentElement;
            if (target.requestFullscreen) { target.requestFullscreen().catch(() => {}); return true; }
            return false;
        })()`);
    } else return { success: false };    return { success: true };
});

// Fetch a remote plain-text file (Home announcements).
ipcMain.handle('app-fetch-text', async (event, url) => {
    try { return { success: true, text: await got(url, { timeout: { request: 15000 } }).text() }; }
    catch (e) { return { success: false, error: e.message }; }
});

// --- Centralized endpoints (kept here, in compiled main, not in plain renderer files) ---
const APP_ENDPOINTS = {
    chatServer:     'http://209.46.127.241',
    paymentQr:      'https://www.dropbox.com/scl/fi/icspyiv4fwl4pcza1wu97/IMG_5155.jpg?rlkey=yu1fw1krhwbjomdywq9nzx8b7&st=gal38snx&raw=1',
    paypalQr:       'https://www.dropbox.com/scl/fi/obt9u5ceql741v59bzetq/5107114A-210E-4AB8-8836-2839837826A4.jpg?rlkey=r1i4xfh16r6ect5wx2yi7aoq9&st=d704tdhd&raw=1',
    contact:        'http://209.46.127.241/gamezonejson/contact.txt',
    distributors:  'http://209.46.127.241/gamezonejson/names.json',
    products:       'http://209.46.127.241/gamezonejson/product details.json',
    others:         'http://209.46.127.241/gamezonejson/others.txt',
    websites:       'http://209.46.127.241/gamezonejson/website.txt',
    chatHelp:       'http://209.46.127.241/gamezonejson/auto reply.txt',
    featuredAppIds: 'http://209.46.127.241/gamezonejson/appid.txt',
    reviews:        'http://209.46.127.241/gamezonejson/reviews.txt'
};

const GAMEZONE_PLAYER_PRELOAD_SOURCES = {
    "watch": "const { contextBridge, ipcRenderer } = require('electron');\n\ncontextBridge.exposeInMainWorld('watchZonePlayerBridge', {\n    onSource(callback) {\n        if (typeof callback !== 'function') return;\n        ipcRenderer.on('watch-zone-player-source', (_event, source) => callback(source));\n    },\n    close() { ipcRenderer.send('watch-zone-player-close'); },\n    progress(value) { ipcRenderer.send('watch-zone-player-progress', value); },\n    scroll(deltaY) { ipcRenderer.send('watch-zone-player-scroll', Number(deltaY) || 0); },\n    fullscreen(enabled) { ipcRenderer.send('watch-zone-player-fullscreen', Boolean(enabled)); },\n    episodeStep(direction) { if (direction === -1 || direction === 1) ipcRenderer.send('watch-zone-player-episode', direction); },\n    onEpisodeNavigation(callback) {\n        if (typeof callback === 'function') ipcRenderer.on('watch-zone-player-episode-navigation', (_event, state) => callback(state));\n    },\n    onFullscreenState(callback) {\n        if (typeof callback !== 'function') return;\n        ipcRenderer.on('watch-zone-player-fullscreen-state', (_event, enabled) => callback(Boolean(enabled)));\n    }\n});\n",
    "retro": "const { contextBridge, ipcRenderer } = require('electron');\ncontextBridge.exposeInMainWorld('retroPlayer', {\n  close: () => ipcRenderer.send('retro-player-close'),\n  toggleFullscreen: () => ipcRenderer.send('retro-player-toggle-fullscreen')\n});\n"
};
function gameZonePlayerPreload(kind) {
    const source = GAMEZONE_PLAYER_PRELOAD_SOURCES[kind];
    if (!source) throw new Error('Unknown player preload');
    const directory = path.join(app.getPath('userData'), 'player-preloads');
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, kind + '.cjs');
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== source) {
        fs.writeFileSync(filename, source, { encoding: 'utf8', mode: 0o600 });
    }
    return filename;
}

const CONTACT_FALLBACK = {
        cards: [
            { label: 'Website', value: 'sites.google.com/view/gamezoneqa', url: 'https://sites.google.com/view/gamezoneqa/home', icon: 'globe' },
            { label: 'Email', value: 'gzoneqa@gmail.com', url: 'mailto:gzoneqa@gmail.com', icon: 'envelope' },
            { label: 'Phone (PH)', value: '+63 969 421 8261', url: 'tel:+639694218261', icon: 'phone' },
            { label: 'WhatsApp', value: '+63 969 421 8261', url: 'https://wa.me/639694218261', icon: 'whatsapp' },
            { label: 'Facebook PH', value: 'm.facebook.com/gamezonephqa', url: 'https://m.facebook.com/gamezonephqa', icon: 'facebook' },
            { label: 'Facebook QA', value: 'm.facebook.com/gamezoneqa', url: 'https://m.facebook.com/gamezoneqa', icon: 'facebook' },
            { label: 'Guns.lol', value: 'guns.lol/gamezoneqa', url: 'https://guns.lol/gamezoneqa', icon: 'gun' }
        ],
        discord: {
            title: 'Join our Discord',
            subtitle: "Gamezone QA's server · 500+ members",
            url: 'https://discord.gg/eQRA252dQt',
            button: 'Go to Server'
        }
    };
let contactDistributorsCache = null;
let contactDistributorsCacheAt = 0;
ipcMain.handle('app-contact-data', async event => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    try { return { success: true, data: await got(APP_ENDPOINTS.contact, { timeout: { request: 15000 }, retry: { limit: 0 } }).json() }; }
    catch (_) { return { success: true, data: CONTACT_FALLBACK, cached: true }; }
});
function normalizeDistributors(payload) {
    const items = Array.isArray(payload) ? payload : payload?.distributors;
    if (!Array.isArray(items)) throw new Error('Invalid distributor catalog');
    const seen = new Set();
    return items.slice(0,3000).map(item => {
        const name = String(item?.name || '').trim().slice(0,100);
        let picture = '';
        try { const url = new URL(item?.picture_url || ''); if (['http:','https:'].includes(url.protocol) && !url.username && !url.password) picture = url.toString(); } catch (_) {}
        const key = `${name}:${picture}`;
        if (!name || seen.has(key)) return null;
        seen.add(key); return { name, picture };
    }).filter(Boolean);
}
ipcMain.handle('app-distributors', async event => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    if (contactDistributorsCache && Date.now() - contactDistributorsCacheAt < 300000) return { success: true, items: contactDistributorsCache };
    try {
        contactDistributorsCache = normalizeDistributors(await got(APP_ENDPOINTS.distributors, { timeout: { request: 15000 }, retry: { limit: 0 } }).json());
        contactDistributorsCacheAt = Date.now();
        return { success: true, items: contactDistributorsCache };
    } catch (_) { return contactDistributorsCache ? { success: true, items: contactDistributorsCache } : { success: false, items: [] }; }
});

// Fetch a registered endpoint's text by KEY (the URL never leaves main).
ipcMain.handle('app-fetch-endpoint', async (event, key) => {
    const url = APP_ENDPOINTS[key];
    if (!url) return { success: false, error: 'Unknown endpoint: ' + key };
    try { return { success: true, text: await got(url, { timeout: { request: 15000 } }).text() }; }
    catch (e) { return { success: false, error: e.message }; }
});

// Expose only the URLs the renderer genuinely needs as URLs (chat server, payment QR image).
ipcMain.handle('app-get-config', () => ({
    chatServer: APP_ENDPOINTS.chatServer,
    paymentQr: APP_ENDPOINTS.paymentQr,
    paypalQr: APP_ENDPOINTS.paypalQr
}));

// Watch Zone data stays in the Electron main process. The renderer only receives
// catalog metadata and asks main to resolve playback; it never gets the TMDB key.
function watchZoneHandle(channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
        if (event.sender !== mainWindow?.webContents || !watchZoneHasAccess()) {
            return { success: false, error: 'Watch Zone requires a Premium membership.' };
        }
        return handler(event, ...args);
    });
}
const WATCH_ZONE_TMDB_KEY = '70120918db94a1e242792b096796a13f';
const WATCH_ZONE_TMDB = 'https://api.themoviedb.org/3';
const WATCH_ZONE_ANILIST = 'https://graphql.anilist.co';
const WATCH_ZONE_IMAGE = 'https://image.tmdb.org/t/p';
const WATCH_ZONE_IYAD_API = 'https://api.iyad.space';
const WATCH_ZONE_IYAD_SITE = 'https://iyadix.free.nf';
const WATCH_ZONE_IYAD_TOKENIZER = 'https://lets.rise2the.top';
const WATCH_ZONE_IYAD_HEADERS = {
    Origin: WATCH_ZONE_IYAD_SITE,
    Referer: WATCH_ZONE_IYAD_SITE + '/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
const WATCH_ZONE_PLAYER_PARTITION = 'persist:gamezoneqa-watch-zone-player';
const watchZoneHttp = require('node:http');
const watchZoneProgressPath = path.join(app.getPath('userData'), 'watch-zone-progress.json');
let watchZonePlayerView = null;
let watchZonePlayerSessionReady = false;
let watchZonePlayerFullscreen = false;
let watchZonePlayerForcedWindowFullscreen = false;
let watchZonePlayerNormalBounds = null;
let watchZoneActiveRequestHeaders = {};
let watchZoneActiveRequestHosts = new Set();
let watchZoneActiveRequestHeaderMaps = new Map();
let watchZoneActiveMedia = null;
let watchZoneMediaServer = null;
let watchZoneMediaOrigin = '';
let watchZoneMediaToken = '';
let watchZoneMediaServerStarting = null;
const watchZoneMediaEntries = new Map();
const watchZoneActiveUpstreams = new Set();
let watchZoneAnimeWorkerPromise = null;
let watchZoneAnimeWarmupPromise = null;
let watchZoneMovieApi = null;
let watchZoneIptvChannelsCache = null;
let watchZoneIptvChannelsCacheAt = 0;
let watchZoneIptvToken = '';
let watchZoneIptvTokenExpiresAt = 0;

function watchZoneGetMovieApi() {
    if (!watchZoneMovieApi) {
        const source = path.join(__dirname, 'watch-zone-api', 'movie', 'server.js');
        const compiled = path.join(__dirname, 'watch-zone-api', 'movie', 'server.jsc');
        watchZoneMovieApi = require(fs.existsSync(source) ? source : compiled).app;
    }
    return watchZoneMovieApi;
}

function watchZoneGetAnimeWorker() {
    if (!watchZoneAnimeWorkerPromise) {
        const source = path.join(__dirname, 'watch-zone-api', 'anime', 'index.js');
        const compiled = path.join(__dirname, 'watch-zone-api', 'anime', 'index.jsc');
        const load = fs.existsSync(source)
            ? import(require('node:url').pathToFileURL(source).href).then(module => module.default)
            : Promise.resolve().then(() => require(compiled).default);
        watchZoneAnimeWorkerPromise = load.catch(error => {
            watchZoneAnimeWorkerPromise = null;
            throw error;
        });
    }
    return watchZoneAnimeWorkerPromise;
}

function watchZoneWarmupAnime() {
    if (!watchZoneAnimeWarmupPromise) {
        watchZoneAnimeWarmupPromise = watchZoneGetAnimeWorker()
            .then(worker => worker.warmup?.())
            .catch(error => {
                console.warn('[Watch Zone] Anime source warmup failed:', error.message);
                watchZoneAnimeWarmupPromise = null;
                return false;
            });
    }
    return watchZoneAnimeWarmupPromise;
}

async function watchZoneHandleAnimeApi(request, response) {
    try {
        const worker = await watchZoneGetAnimeWorker();
        const workerResponse = await worker.fetch(new Request(`http://127.0.0.1${request.url}`, {
            method: request.method,
            headers: request.headers
        }));
        response.writeHead(workerResponse.status, Object.fromEntries(workerResponse.headers));
        response.end(Buffer.from(await workerResponse.arrayBuffer()));
    } catch (error) {
        if (!response.headersSent) response.writeHead(502, { ...watchZoneCorsHeaders(), 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: error.message || 'Anime source resolution failed' }));
    }
}

function watchZoneHandleMovieApi(request, response) {
    try {
        watchZoneGetMovieApi()(request, response);
    } catch (error) {
        if (!response.headersSent) response.writeHead(502, { ...watchZoneCorsHeaders(), 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: error.message || 'Movie source resolution failed' }));
    }
}

const WATCH_ZONE_ANIME_FIELDS = `id idMal title { english romaji native } synonyms coverImage { large extraLarge } bannerImage description(asHtml:false) genres format averageScore episodes status isAdult startDate { year month day } nextAiringEpisode { episode airingAt }`;

function watchZoneEncode(value) { return encodeURIComponent(String(value == null ? '' : value)); }
function watchZoneImage(pathValue, size = 'w500') {
    if (!pathValue) return '';
    if (/^https?:\/\//i.test(pathValue)) return pathValue;
    return `${WATCH_ZONE_IMAGE}/${size}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
}
function watchZoneNormalizeTmdb(item, fallbackType = 'movie') {
    if (!item || typeof item !== 'object') return null;
    const type = item.media_type === 'tv' || fallbackType === 'tv' || item.name ? 'tv' : 'movie';
    const id = Number(item.id) || 0;
    const title = String(item.title || item.name || '').trim();
    if (!id || !title || item.adult) return null;
    const date = String(item.release_date || item.first_air_date || '');
    return {
        id, mode: 'movie', mediaType: type, title,
        overview: String(item.overview || ''),
        poster: watchZoneImage(item.poster_path, 'w500'),
        banner: watchZoneImage(item.backdrop_path, 'w1280'),
        year: date.slice(0, 4),
        score: Number(item.vote_average) || 0,
        genres: Array.isArray(item.genre_ids) ? item.genre_ids : [],
        releaseDate: date,
        runtime: Number(item.runtime) || 0,
        episodeCount: Number(item.number_of_episodes) || 0,
        seasonCount: Number(item.number_of_seasons) || 0
    };
}
function watchZoneNormalizeAnime(item) {
    if (!item || typeof item !== 'object' || item.isAdult) return null;
    const id = Number(item.id) || 0;
    const title = String(item.title?.english || item.title?.romaji || item.title?.native || '').trim();
    if (!id || !title) return null;
    return {
        id, mode: 'anime', mediaType: 'anime', title,
        titleEnglish: String(item.title?.english || ''),
        titleRomaji: String(item.title?.romaji || ''),
        synonyms: Array.isArray(item.synonyms) ? item.synonyms.slice(0, 8) : [],
        malId: Number(item.idMal) || 0,
        overview: String(item.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        poster: item.coverImage?.extraLarge || item.coverImage?.large || '',
        banner: item.bannerImage || '',
        year: Number(item.startDate?.year) || '',
        score: Number(item.averageScore) || 0,
        genres: Array.isArray(item.genres) ? item.genres : [],
        format: String(item.format || ''),
        status: String(item.status || ''),
        episodeCount: Number(item.episodes) || 0,
        nextEpisode: item.nextAiringEpisode ? Number(item.nextAiringEpisode.episode) || 0 : 0,
        airingAt: item.nextAiringEpisode ? Number(item.nextAiringEpisode.airingAt) || 0 : 0
    };
}
async function watchZoneFetchJson(url, options = {}) {
    return got(url, {
        timeout: { request: 18000 },
        retry: { limit: 1 },
        headers: { 'user-agent': 'GameZoneQA-WatchZone/1.0', accept: 'application/json', ...(options.headers || {}) },
        ...options
    }).json();
}
function watchZoneIptvDecrypt(payload, rawKey) {
    const input = Buffer.from(String(payload || ''), 'base64');
    if (input.length < 32 || input.length % 16 !== 0) throw new Error('The IPTV source returned an invalid encrypted payload.');
    const keyInput = Buffer.from(String(rawKey || ''), 'utf8');
    if (!keyInput.length) throw new Error('The IPTV source did not return a decryption key.');
    const key = Buffer.alloc(16);
    keyInput.copy(key, 0, 0, Math.min(16, keyInput.length));
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, input.subarray(0, 16));
    return Buffer.concat([decipher.update(input.subarray(16)), decipher.final()]).toString('utf8');
}
async function watchZoneIptvGetToken() {
    if (watchZoneIptvToken && Date.now() < watchZoneIptvTokenExpiresAt) return watchZoneIptvToken;
    const response = await watchZoneFetchJson(WATCH_ZONE_IYAD_API + '/token', { headers: WATCH_ZONE_IYAD_HEADERS });
    if (!response?.token) throw new Error('The IPTV source did not provide an access token.');
    watchZoneIptvToken = String(response.token);
    watchZoneIptvTokenExpiresAt = Date.now() + Math.max(60, Number(response.expires) || 3600) * 1000 - 30000;
    return watchZoneIptvToken;
}
function watchZoneIptvSourceHeaders() {
    return { ...WATCH_ZONE_IYAD_HEADERS };
}
function watchZoneIptvClearKey(value) {
    const text = String(value || '').trim().replace(/-/g, '');
    if (/^[a-f0-9]{32}$/i.test(text)) return text.toLowerCase();
    const bytes = Buffer.from(String(value || '').trim(), 'base64url');
    if (bytes.length !== 16) throw new Error('The IPTV source returned an invalid ClearKey value.');
    return bytes.toString('hex');
}
async function watchZoneIptvDirectStream(stream) {
    if (!['dash', 'mpd', 'hls'].includes(stream.type)) return stream;
    const response = await got(stream.url, {
        headers: stream.headers, timeout: { request: 20000 }, retry: { limit: 0 }, throwHttpErrors: false
    });
    if (response.statusCode !== 200) throw new Error(`The IPTV manifest is unavailable (HTTP ${response.statusCode}). Try another source.`);
    const isDash = /<MPD\b/i.test(response.body);
    if (!isDash && !/^\s*#EXTM3U/.test(response.body)) throw new Error('The IPTV source returned a page instead of a media manifest.');
    const final = new URL(response.url);
    return {
        ...stream, type: isDash ? 'dash' : 'hls', url: final.toString(), direct: true,
        keyId: stream.keyId ? watchZoneIptvClearKey(stream.keyId) : '',
        key: stream.key ? watchZoneIptvClearKey(stream.key) : '',
        playback: {
            engine: 'shaka', queryParams: Object.fromEntries(final.searchParams),
            queryScope: { origin: final.origin, path: new URL('.', final).pathname }
        }
    };
}
async function watchZoneIptvGetChannels(forceRefresh = false) {
    if (!forceRefresh && watchZoneIptvChannelsCache && Date.now() - watchZoneIptvChannelsCacheAt < 5 * 60 * 1000) {
        return watchZoneIptvChannelsCache;
    }
    const token = await watchZoneIptvGetToken();
    const headers = { ...WATCH_ZONE_IYAD_HEADERS, Authorization: 'Bearer ' + token };
    const [keyResponse, dataResponse] = await Promise.all([
        watchZoneFetchJson(WATCH_ZONE_IYAD_API + '/key', { headers }),
        watchZoneFetchJson(WATCH_ZONE_IYAD_API + '/data', { headers })
    ]);
    if (!keyResponse?.key || !dataResponse?.data) throw new Error('The IPTV source returned an incomplete channel catalog.');
    const rawChannels = JSON.parse(watchZoneIptvDecrypt(dataResponse.data, keyResponse.key));
    if (!Array.isArray(rawChannels)) throw new Error('The IPTV source channel catalog is not a list.');
    const channels = rawChannels.filter(channel => channel && channel.enabled !== false).map(channel => {
        const sources = [{ name: String(channel.name || 'Channel'), serverIndex: 0, logo: channel.logo || null }];
        for (let index = 1; index <= 10; index++) {
            const suffix = index === 1 ? '' : String(index);
            const name = channel['alt_name' + suffix];
            if (channel['alt_enabled' + suffix] !== false && name) {
                const label = /^Stream \d+$/.test(String(name)) ? String(channel.name || 'Channel') + ' ' + name : String(name);
                sources.push({ name: label, serverIndex: index, logo: channel['alt_logo' + suffix] || channel.logo || null });
            }
        }
        const rawTags = Array.isArray(channel.tags)
            ? channel.tags.map(tag => String(tag || '').trim()).filter(Boolean)
            : String(channel.tags || '').split(/[,|]/).map(tag => tag.trim()).filter(Boolean);
        const seenTags = new Set();
        const tags = rawTags.filter(tag => {
            const key = tag.toLowerCase();
            if (!key || seenTags.has(key)) return false;
            seenTags.add(key);
            return true;
        });
        const name = String(channel.name || '').trim();
        if (!name) return null;
        let logo = '';
        if (channel.logo) {
            try { logo = watchZoneUrl(new URL(String(channel.logo), WATCH_ZONE_IYAD_SITE).toString()); } catch (_) {}
        }
        return {
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name, logo,
            tags: Array.from(new Set(tags)), type: String(channel.type || 'hls'),
            channelId: String(channel.channelId || ''), sources
        };
    }).filter(Boolean);
    watchZoneIptvChannelsCache = channels;
    watchZoneIptvChannelsCacheAt = Date.now();
    return channels;
}
async function watchZoneIptvTokenizeUrl(url) {
    const value = watchZoneUrl(url);
    if (!value) throw new Error('The IPTV provider did not return a valid stream URL.');
    const parsed = new URL(value);
    if (!/(^|\.)rise2\.?the\.top$/i.test(parsed.hostname) || /\/(?:t|aldous)\//i.test(parsed.pathname)) return value;
    try {
        const result = await watchZoneFetchJson(WATCH_ZONE_IYAD_TOKENIZER + '/estes', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            json: { url: value, expiry: 3600 }, timeout: { request: 12000 }, retry: { limit: 0 }
        });
        const tokenizedUrl = watchZoneUrl(result?.tokenizedUrl);
        if (!tokenizedUrl || tokenizedUrl === value) throw new Error('the token service returned no protected stream URL');
        return tokenizedUrl;
    } catch (error) {
        console.warn('[Watch Zone] IPTV stream tokenization failed:', error.message);
        throw new Error('The IPTV stream could not be authorized. Refresh the channel and try again.');
    }
}
async function watchZoneIptvGetStream(channelIdOrName, rawServerIndex = 0) {
    const channels = await watchZoneIptvGetChannels();
    const search = String(channelIdOrName || '').trim().toLowerCase();
    const channel = channels.find(item => item.id === search || item.name.toLowerCase() === search);
    if (!channel) throw new Error('That IPTV channel is no longer available. Refresh the channel list.');
    const serverIndex = Math.max(0, Math.min(10, Math.floor(Number(rawServerIndex) || 0)));
    const selectedSource = channel.sources.find(source => source.serverIndex === serverIndex);
    if (!selectedSource) throw new Error('That IPTV source is not available for this channel.');
    const token = await watchZoneIptvGetToken();
    const headers = { ...WATCH_ZONE_IYAD_HEADERS, Authorization: 'Bearer ' + token };
    const keyResponse = await watchZoneFetchJson(WATCH_ZONE_IYAD_API + '/key', { headers });
    const playResponse = await watchZoneFetchJson(WATCH_ZONE_IYAD_API + '/play', {
        method: 'POST', headers, json: { channelName: channel.name, serverIndex }
    });
    if (!keyResponse?.key || !playResponse?.data) throw new Error('The IPTV source returned incomplete playback data.');
    const rawStream = JSON.parse(watchZoneIptvDecrypt(playResponse.data, keyResponse.key));
    const makeStream = async streamData => {
        const rawUrl = watchZoneUrl(streamData?.url || streamData?.embedUrl);
        if (!rawUrl) throw new Error('The IPTV source did not return a playable stream URL.');
        let type = String(streamData.type || channel.type || 'hls').toLowerCase();
        const lowerUrl = rawUrl.toLowerCase();
        if (/\.m3u8(?:$|[?#])|plex-epg|variant/.test(lowerUrl)) type = 'hls';
        else if (/\.mpd(?:$|[?#])/.test(lowerUrl)) type = 'dash';
        else if (/youtube\.com|youtu\.be/.test(lowerUrl)) type = 'youtube';
        return watchZoneIptvDirectStream({
            type, url: await watchZoneIptvTokenizeUrl(rawUrl), rawUrl,
            keyId: String(streamData.keyId || ''), key: String(streamData.key || ''),
            headers: watchZoneIptvSourceHeaders()
        });
    };
    const stream = await makeStream(rawStream);
    return {
        channel, selectedSource, serverIndex, stream,
        availableSources: channel.sources
    };
}
async function watchZoneAniList(query, variables = {}) {
    const result = await got.post(WATCH_ZONE_ANILIST, {
        timeout: { request: 18000 },
        retry: { limit: 1 },
        headers: { 'user-agent': 'GameZoneQA-WatchZone/1.0', accept: 'application/json' },
        json: { query, variables }
    }).json();
    if (Array.isArray(result.errors) && result.errors.length) throw new Error(result.errors[0].message || 'AniList request failed');
    return result.data || {};
}
async function watchZoneTmdb(pathname, params = {}) {
    const url = new URL(`${WATCH_ZONE_TMDB}${pathname}`);
    url.searchParams.set('api_key', WATCH_ZONE_TMDB_KEY);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return watchZoneFetchJson(url.toString());
}
function watchZoneAniListMedia(items) {
    return (Array.isArray(items) ? items : []).map(watchZoneNormalizeAnime).filter(Boolean);
}
function watchZoneTmdbMedia(items, fallbackType = 'movie') {
    return (Array.isArray(items) ? items : []).map(item => watchZoneNormalizeTmdb(item, fallbackType)).filter(Boolean);
}

watchZoneHandle('watch-zone-iptv-channels', async (event, forceRefresh = false) => {
    if (event.sender !== mainWindow?.webContents) return { success: false, error: 'Invalid channel list request.' };
    try {
        return { success: true, channels: await watchZoneIptvGetChannels(Boolean(forceRefresh)) };
    } catch (error) {
        console.warn('[Watch Zone] IPTV channel request failed:', error.message);
        return { success: false, error: 'Live channels could not be loaded right now.' };
    }
});

const watchZoneTopCartoons = (() => {
const BASE_URL = "https://www.topcartoons.tv";

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

// Caching layer
let cachedSeries = null;
let lastSeriesCheck = 0;
const SERIES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const seriesEpisodesCache = new Map();
const EPISODES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Decodes standard HTML entities in scraped titles and descriptions
 */
function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "--")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

/**
 * Extracts clean cartoon slug from a URL, path, or raw slug
 */
function extractSlug(input) {
  if (!input) return "";
  let str = String(input).trim();
  try {
    if (str.startsWith("http://") || str.startsWith("https://")) {
      const u = new URL(str);
      str = u.pathname;
    }
  } catch {}

  // Strip prefixes and query parameters
  str = str.replace(/\/+$/, "");
  const parts = str.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || str;
  return last.replace(/^cartoons-|^serie-/, "").toLowerCase();
}

/**
 * 1. Fetches all Cartoon Series / Categories from https://www.topcartoons.tv/serie/
 */
async function getSeriesList(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSeries && (now - lastSeriesCheck < SERIES_CACHE_TTL)) {
    return cachedSeries;
  }

  const res = await fetch(`${BASE_URL}/serie/`, {
    headers: COMMON_HEADERS, signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch series archive: HTTP ${res.status}`);
  }

  const html = await res.text();
  const series = [];
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const article = match[1];
    const linkMatch = article.match(/href="https:\/\/www\.topcartoons\.tv\/serie\/([^"\/]+)\/?"/i);
    const titleMatch = article.match(/title="([^"]+)"/i) || article.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const imgMatch = article.match(/data-src="([^"]+)"/i) || article.match(/src="([^"]+)"/i);
    const countMatch = article.match(/<span>(\d+\s*Videos)<\/span>/i);
    const idMatch = article.match(/data-post-id="(\d+)"/i) || article.match(/id="post-(\d+)"/i);

    if (linkMatch) {
      const slug = linkMatch[1];
      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : slug;
      const countStr = countMatch ? countMatch[1] : null;
      let totalVideos = null;
      if (countStr) {
        const num = parseInt(countStr.replace(/\D/g, ""), 10);
        if (!isNaN(num)) totalVideos = num;
      }

      series.push({
        id: idMatch ? idMatch[1] : null,
        slug,
        name: decodeHtmlEntities(rawTitle),
        videoCount: countStr || null,
        totalVideos,
        thumbnail: imgMatch ? imgMatch[1] : null,
        url: `${BASE_URL}/serie/${slug}/`
      });
    }
  }

  cachedSeries = series;
  lastSeriesCheck = now;
  return series;
}

/**
 * 2. Fetches episodes for a specific series (e.g. merrie-melodies, tom-and-jerry)
 */
async function getSeriesEpisodes(seriesSlugInput, options = {}) {
  const slug = extractSlug(seriesSlugInput);
  if (!slug) {
    throw new Error("Missing or invalid series slug.");
  }

  const now = Date.now();
  const cacheKey = slug;
  if (!options.forceRefresh && seriesEpisodesCache.has(cacheKey)) {
    const cached = seriesEpisodesCache.get(cacheKey);
    if (now - cached.timestamp < EPISODES_CACHE_TTL) {
      return paginateEpisodes(cached.data, options);
    }
  }

  const seriesUrl = `${BASE_URL}/serie/${slug}/`;
  const res = await fetch(seriesUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(20000) });

  if (!res.ok) {
    throw new Error(`Failed to fetch series "${slug}": HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract series header info
  const h1Match = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                  html.match(/<title>([^<|]+)/i);
  const seriesName = h1Match ? decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, "").trim()) : slug;

  const headerImgMatch = html.match(/class="header-img"[\s\S]*?data-src="([^"]+)"/i) ||
                         html.match(/<meta property="og:image" content="([^"]+)"/i);
  const seriesThumbnail = headerImgMatch ? headerImgMatch[1] : null;

  // Extract episodes list from post items
  const episodes = [];
  const articleRegex = /<article[^>]*id="post-(\d+)"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const postId = match[1];
    const article = match[2];

    // Filter out header article if present
    if (article.includes("single-post-content") || article.includes("header-single-with-image")) {
      continue;
    }

    const linkMatch = article.match(/href="(https:\/\/www\.topcartoons\.tv\/cartoons\/[^"\/]+\/[^"]*)"/i);
    const titleMatch = article.match(/<h3[^>]*post-title[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                       article.match(/title="([^"]+)"/i);
    const imgMatch = article.match(/data-src="([^"]+)"/i) || article.match(/src="([^"]+)"/i);
    const previewMatch = article.match(/data-iframepreview="([^"]+)"/i);
    const durationMatch = article.match(/<span[^>]*duration-text[^>]*>([\s\S]*?)<\/span>/i);

    if (linkMatch) {
      const episodeUrl = linkMatch[1];
      const epSlug = extractSlug(episodeUrl);
      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : epSlug;
      const duration = durationMatch ? durationMatch[1].replace(/<[^>]+>/g, "").trim() : null;

      episodes.push({
        id: postId,
        slug: epSlug,
        title: decodeHtmlEntities(rawTitle),
        url: episodeUrl,
        thumbnail: imgMatch ? imgMatch[1] : null,
        previewEmbedUrl: previewMatch ? decodeHtmlEntities(previewMatch[1]) : null,
        duration: duration || null
      });
    }
  }

  const seriesData = {
    series: {
      slug,
      name: seriesName,
      thumbnail: seriesThumbnail,
      url: seriesUrl,
      totalEpisodes: episodes.length
    },
    totalEpisodes: episodes.length,
    episodes
  };

  seriesEpisodesCache.set(cacheKey, { data: seriesData, timestamp: now });
  return paginateEpisodes(seriesData, options);
}

function paginateEpisodes(data, options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = options.limit !== undefined ? Number(options.limit) : null;

  if (!limit || limit <= 0) {
    return {
      ...data,
      page: 1,
      limit: data.episodes.length,
      totalPages: 1
    };
  }

  const total = data.episodes.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paginated = data.episodes.slice(start, start + limit);

  return {
    series: data.series,
    totalEpisodes: total,
    page,
    limit,
    totalPages,
    episodes: paginated
  };
}

/**
 * 3. Extracts Video Information, MP4 Video URL, thumbnail, and details from an episode
 */
async function extractCartoon(slugOrUrl) {
  if (!slugOrUrl) {
    throw new Error("Missing cartoon slug or URL.");
  }

  let targetUrl = String(slugOrUrl).trim();
  const slug = extractSlug(targetUrl);

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `${BASE_URL}/cartoons/${slug}/`;
  }

  const res = await fetch(targetUrl, {
    signal: AbortSignal.timeout(20000),
    headers: {
      ...COMMON_HEADERS,
      "Referer": `${BASE_URL}/`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch cartoon page (${targetUrl}): HTTP ${res.status}`);
  }

  const html = await res.text();

  // 1. Direct Video URL Extraction
  let videoUrl = null;
  // Look for <video src="..."> tag
  const videoSrcMatch = html.match(/<video[^>]*src="([^"]+)"[^>]*>/i);
  if (videoSrcMatch && videoSrcMatch[1]) {
    videoUrl = videoSrcMatch[1];
  }

  // Fallback: <source src="..." type="video/mp4">
  if (!videoUrl) {
    const sourceMatch = html.match(/<source[^>]*src="([^"]+)"[^>]*>/i);
    if (sourceMatch && sourceMatch[1]) {
      videoUrl = sourceMatch[1];
    }
  }

  // Fallback: .mp4 URLs inside scripts or attributes
  if (!videoUrl) {
    const mp4Match = html.match(/https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/i);
    if (mp4Match) {
      videoUrl = mp4Match[0];
    }
  }

  if (!videoUrl) {
    throw new Error(`No MP4 video URL found on cartoon page "${slug}".`);
  }

  // 2. Title Extraction
  const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<meta property="og:title" content="([^"]+)"/i) ||
                     html.match(/<title>([^<|]+)/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim()) : slug;

  // 3. Thumbnail / Poster Image
  const posterMatch = html.match(/poster="([^"]+)"/i);
  const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const imgMatch = html.match(/class="wp-post-image"[^>]*src="([^"]+)"/i) ||
                   html.match(/data-src="([^"]+)"/i);
  const thumbnail = posterMatch ? posterMatch[1] : (ogImgMatch ? ogImgMatch[1] : (imgMatch ? imgMatch[1] : null));

  // 4. Description / Synopsis
  let description = "";
  // Check JSON-LD VideoObject first
  const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const jScript of jsonLdMatch) {
      try {
        const cleanJson = jScript.replace(/<script[^>]*>|<\/script>/gi, "");
        const obj = JSON.parse(cleanJson);
        if (obj["@type"] === "VideoObject" && obj.description) {
          description = decodeHtmlEntities(obj.description);
          break;
        }
      } catch {}
    }
  }

  if (!description) {
    const descMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
      description = decodeHtmlEntities(descMatch[1].replace(/<[^>]+>/g, "").trim());
    }
  }

  // 5. Series Info
  let series = null;
  const seriesLinkMatch = html.match(/<a[^>]*href="https:\/\/www\.topcartoons\.tv\/serie\/([^"\/]+)\/?"[^>]*>([\s\S]*?)<\/a>/i);
  if (seriesLinkMatch) {
    const sSlug = seriesLinkMatch[1];
    const sName = seriesLinkMatch[2].replace(/<[^>]+>/g, "").trim();
    series = {
      slug: sSlug,
      name: decodeHtmlEntities(sName) || sSlug,
      url: `${BASE_URL}/serie/${sSlug}/`
    };
  }

  // Post ID
  const idMatch = html.match(/id="post-(\d+)"/i) || html.match(/data-post-id="(\d+)"/i);

  return {
    status: "success",
    provider: "topcartoons",
    id: idMatch ? idMatch[1] : null,
    slug,
    title,
    thumbnail,
    description: description || null,
    series: series || null,
    video: {
      type: "mp4",
      url: videoUrl,
      headers: {
        "User-Agent": COMMON_HEADERS["User-Agent"],
        "Referer": `${BASE_URL}/`
      }
    },
    sourcePage: targetUrl
  };
}

/**
 * 4. Searches Cartoons and Series from TopCartoons
 */
async function searchCartoons(queryInput, page = 1) {
  const query = String(queryInput || "").trim();
  if (!query) {
    return { query: "", page: 1, totalResults: 0, results: [] };
  }

  const pageNum = Math.max(1, Number(page || 1));
  const searchUrl = pageNum > 1
    ? `${BASE_URL}/page/${pageNum}/?s=${encodeURIComponent(query)}`
    : `${BASE_URL}/?s=${encodeURIComponent(query)}`;

  const res = await fetch(searchUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`Search failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const articles = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];
  const results = [];

  for (const art of articles) {
    const linkMatch = art.match(/href="(https:\/\/www\.topcartoons\.tv\/[^"]+)"/i);
    const titleMatch = art.match(/<h3[^>]*post-title[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                       art.match(/title="([^"]+)"/i);
    const imgMatch = art.match(/data-src="([^"]+)"/i) || art.match(/src="([^"]+)"/i);
    const isSeries = art.includes("vid_series") || (linkMatch && linkMatch[1].includes("/serie/"));
    const isCartoon = linkMatch && linkMatch[1].includes("/cartoons/");

    if (linkMatch && (isSeries || isCartoon)) {
      const link = linkMatch[1];
      const slug = extractSlug(link);
      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : slug;

      results.push({
        type: isSeries ? "series" : "cartoon",
        id: (art.match(/id="post-(\d+)"/i) || [])[1] || null,
        slug,
        title: decodeHtmlEntities(rawTitle),
        url: link,
        thumbnail: imgMatch ? imgMatch[1] : null
      });
    }
  }

  return {
    status: "success",
    provider: "topcartoons",
    query,
    page: pageNum,
    count: results.length,
    results
  };
}

async function getSeriesShelves(forceRefresh = false) {
  const series = await getSeriesList(forceRefresh);
  const top = [...series].sort((a, b) => (Number(b.totalVideos) || 0) - (Number(a.totalVideos) || 0) || a.name.localeCompare(b.name));
  const small = series.filter(item => Number(item.totalVideos) > 0 && Number(item.totalVideos) <= 50)
    .sort((a, b) => Number(a.totalVideos) - Number(b.totalVideos) || a.name.localeCompare(b.name));
  return {
    heroes: top.slice(0, 5),
    shelves: [
      { id: 'top-series', title: 'Top Series', ranking: 'Episode count, descending (not view popularity)', items: top },
      { id: 'short-and-sweet', title: 'Short & Sweet', ranking: '50 episodes or fewer, episode count ascending', items: small }
    ]
  };
}

return {
  BASE_URL,
  COMMON_HEADERS,
  getSeriesList,
  getSeriesShelves,
  getSeriesEpisodes,
  extractCartoon,
  searchCartoons,
  extractSlug,
  decodeHtmlEntities
};

})();
function watchZoneCartoonItem(item) {
    return { mode: "cartoon", mediaType: "tv", id: Number(item.id) || 1, slug: item.slug, title: item.name, poster: item.thumbnail, banner: item.thumbnail, episodeCount: item.totalVideos, format: "Cartoon series" };
}
function watchZoneCartoonShelves(series) {
    const items = series.map(watchZoneCartoonItem);
    const primary = [...items].sort((a, b) => (Number(b.episodeCount) || 0) - (Number(a.episodeCount) || 0) || a.title.localeCompare(b.title));
    const secondary = items.filter(item => Number(item.episodeCount) > 0 && Number(item.episodeCount) <= 50)
        .sort((a, b) => Number(a.episodeCount) - Number(b.episodeCount) || a.title.localeCompare(b.title));
    return { primary, secondary };
}
ipcMain.handle("watch-zone-cartoon-episodes", async (event, slug, force = false) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    try {
        if (!/^[a-z0-9-]+$/.test(String(slug))) throw new Error("Invalid series");
        const data = await watchZoneTopCartoons.getSeriesEpisodes(slug, { forceRefresh: Boolean(force) });
        return { success: true, episodes: data.episodes.map((episode, index) => ({ number: index + 1, title: episode.title, still: episode.thumbnail, slug: episode.slug })) };
    } catch (error) { return { success: false, error: error.message }; }
});

watchZoneHandle('watch-zone-home', async (_event, mode = 'movie', forceRefresh = false) => {
    if (mode === 'cartoon') {
        try {
            const shelves = watchZoneCartoonShelves(await watchZoneTopCartoons.getSeriesList(Boolean(forceRefresh)));
            return { success: true, mode, primary: shelves.primary.slice(0,12), secondary: shelves.secondary.slice(0,12), heroes: shelves.primary.slice(0,5), hero: shelves.primary[0], primaryTitle: 'Top Series', primaryEyebrow: 'LARGEST EPISODE COLLECTIONS', secondaryTitle: 'Short & Sweet', secondaryEyebrow: 'SMALLER SERIES · 50 EPISODES OR FEWER' };
        }
        catch (error) { return { success: false, error: error.message }; }
    }
    try {
        if (mode === 'anime') {
            watchZoneWarmupAnime();
            const query = `query ($page:Int,$perPage:Int) { Page(page:$page,perPage:$perPage) { media(type:ANIME,status:RELEASING,isAdult:false,sort:[TRENDING_DESC,POPULARITY_DESC]) { ${WATCH_ZONE_ANIME_FIELDS} } } }`;
            const popularQuery = `query ($page:Int,$perPage:Int) { Page(page:$page,perPage:$perPage) { media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC,TRENDING_DESC]) { ${WATCH_ZONE_ANIME_FIELDS} } } }`;
            const [airingData, popularData] = await Promise.all([
                watchZoneAniList(query, { page: 1, perPage: 18 }),
                watchZoneAniList(popularQuery, { page: 1, perPage: 18 })
            ]);
            const airing = watchZoneAniListMedia(airingData.Page?.media);
            const popular = watchZoneAniListMedia(popularData.Page?.media);
            return { success: true, mode: 'anime', hero: airing[0] || popular[0] || null, primary: airing, secondary: popular, primaryTitle: 'Top Airing', secondaryTitle: 'Popular Anime' };
        }
        const [trendingData, movieData, tvData] = await Promise.all([
            watchZoneTmdb('/trending/all/week', { page: 1 }),
            watchZoneTmdb('/movie/popular', { page: 1 }),
            watchZoneTmdb('/tv/on_the_air', { page: 1 })
        ]);
        const trending = watchZoneTmdbMedia(trendingData.results);
        const popular = watchZoneTmdbMedia(movieData.results, 'movie');
        const airing = watchZoneTmdbMedia(tvData.results, 'tv');
        const secondary = [...popular, ...airing].filter((item, index, all) => all.findIndex(other => `${other.mediaType}:${other.id}` === `${item.mediaType}:${item.id}`) === index);
        return { success: true, mode: 'movie', hero: trending[0] || popular[0] || null, primary: trending, secondary, primaryTitle: 'Trending Movies & Shows', secondaryTitle: 'Popular Movies & Shows' };
    } catch (error) {
        console.warn('[Watch Zone] Home catalog request failed:', error.message);
        return { success: false, error: 'Catalog could not be loaded right now.' };
    }
});

watchZoneHandle('watch-zone-view-all', async (_event, mode = 'movie', section = 'primary', rawPage = 1) => {
    if (mode === 'cartoon') {
        try { const shelves = watchZoneCartoonShelves(await watchZoneTopCartoons.getSeriesList()); const items = section === 'secondary' ? shelves.secondary : shelves.primary; const page = Math.max(1, Number(rawPage) || 1); return { success: true, items: items.slice((page - 1) * 24, page * 24), page, hasMore: page * 24 < items.length }; }
        catch (error) { return { success: false, error: error.message }; }
    }
    const page = Math.max(1, Math.min(500, Math.floor(Number(rawPage) || 1)));
    const shelf = section === 'secondary' ? 'secondary' : 'primary';
    try {
        if (mode === 'anime') {
            const sort = shelf === 'primary' ? '[TRENDING_DESC,POPULARITY_DESC]' : '[POPULARITY_DESC,TRENDING_DESC]';
            const query = `query ($page:Int,$perPage:Int) { Page(page:$page,perPage:$perPage) { pageInfo { currentPage hasNextPage total } media(type:ANIME,isAdult:false,sort:${sort}) { ${WATCH_ZONE_ANIME_FIELDS} } } }`;
            const data = await watchZoneAniList(query, { page, perPage: 18 });
            const resultPage = data.Page;
            return { success: true, page, items: watchZoneAniListMedia(resultPage?.media), hasMore: Boolean(resultPage?.pageInfo?.hasNextPage), total: Number(resultPage?.pageInfo?.total) || 0 };
        }
        if (shelf === 'primary') {
            const data = await watchZoneTmdb('/trending/all/week', { page });
            return { success: true, page, items: watchZoneTmdbMedia(data.results), hasMore: page < (Number(data.total_pages) || 1), total: Number(data.total_results) || 0 };
        }
        const [movies, shows] = await Promise.all([
            watchZoneTmdb('/movie/popular', { page }),
            watchZoneTmdb('/tv/on_the_air', { page })
        ]);
        const items = [...watchZoneTmdbMedia(movies.results, 'movie'), ...watchZoneTmdbMedia(shows.results, 'tv')];
        return {
            success: true, page,
            items: items.filter((item, index, all) => all.findIndex(other => `${other.mediaType}:${other.id}` === `${item.mediaType}:${item.id}`) === index),
            hasMore: page < Math.max(Number(movies.total_pages) || 1, Number(shows.total_pages) || 1),
            total: (Number(movies.total_results) || 0) + (Number(shows.total_results) || 0)
        };
    } catch (error) {
        console.warn('[Watch Zone] View All request failed:', error.message);
        return { success: false, error: 'More titles could not be loaded right now.' };
    }
});

watchZoneHandle('watch-zone-search', async (_event, mode = 'movie', rawQuery = '') => {
    if (mode === 'cartoon') {
        try { const query = String(rawQuery).toLowerCase(); return { success: true, items: (await watchZoneTopCartoons.getSeriesList()).filter(item => item.name.toLowerCase().includes(query)).map(watchZoneCartoonItem) }; }
        catch (error) { return { success: false, error: error.message }; }
    }
    const queryText = String(rawQuery || '').trim().slice(0, 120);
    if (!queryText) return { success: true, items: [] };
    try {
        if (mode === 'anime') {
            const query = `query ($search:String,$page:Int,$perPage:Int) { Page(page:$page,perPage:$perPage) { media(type:ANIME,isAdult:false,search:$search,sort:[SEARCH_MATCH]) { ${WATCH_ZONE_ANIME_FIELDS} } } }`;
            const data = await watchZoneAniList(query, { search: queryText, page: 1, perPage: 36 });
            return { success: true, items: watchZoneAniListMedia(data.Page?.media) };
        }
        const data = await watchZoneTmdb('/search/multi', { query: queryText, include_adult: false, page: 1 });
        return { success: true, items: watchZoneTmdbMedia(data.results) };
    } catch (error) {
        console.warn('[Watch Zone] Search failed:', error.message);
        return { success: false, error: 'Search is temporarily unavailable.' };
    }
});

watchZoneHandle('watch-zone-details', async (_event, mode, mediaId, mediaType = '') => {
    const id = Number(mediaId) || 0;
    if (!id) return { success: false, error: 'Invalid title.' };
    try {
        if (mode === 'anime') {
            const query = `query ($id:Int) { Media(id:$id,type:ANIME) { ${WATCH_ZONE_ANIME_FIELDS} } }`;
            const data = await watchZoneAniList(query, { id });
            const item = watchZoneNormalizeAnime(data.Media);
            if (!item) throw new Error('Anime details are unavailable.');
            return { success: true, item, related: [] };
        }
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const detail = await watchZoneTmdb(`/${type}/${id}`);
        const item = watchZoneNormalizeTmdb({ ...detail, media_type: type }, type);
        if (!item) throw new Error('Movie or show details are unavailable.');
        item.genres = Array.isArray(detail.genres) ? detail.genres.map(genre => genre.name).filter(Boolean) : [];
        item.seasonCount = Number(detail.number_of_seasons) || 0;
        item.episodeCount = Number(detail.number_of_episodes) || 0;
        item.seasons = Array.isArray(detail.seasons) ? detail.seasons.filter(season => Number(season.season_number) > 0).map(season => ({ number: Number(season.season_number), name: season.name, episodeCount: Number(season.episode_count) || 0 })) : [];
        return { success: true, item, related: [] };
    } catch (error) {
        console.warn('[Watch Zone] Details request failed:', error.message);
        return { success: false, error: 'Details could not be loaded right now.' };
    }
});

watchZoneHandle('watch-zone-anime-episodes', async (_event, mediaId) => {
    const id = Number(mediaId) || 0;
    if (!id) return { success: false, error: 'Invalid anime.' };
    try {
        const query = `query ($id:Int) { Media(id:$id,type:ANIME) { episodes status nextAiringEpisode { episode } streamingEpisodes { title thumbnail } } }`;
        const data = await watchZoneAniList(query, { id });
        const media = data.Media;
        if (!media) throw new Error('Anime episode data is unavailable.');
        const byNumber = new Map();
        (Array.isArray(media.streamingEpisodes) ? media.streamingEpisodes : []).forEach((episode, index) => {
            const title = String(episode?.title || '').trim();
            const match = title.match(/\b(?:episode|ep\.?)[\s#:-]*(\d{1,4})\b/i) || title.match(/^\s*(\d{1,4})(?=\s*(?:[-–:.)]|$))/);
            const number = Number(match?.[1]) || index + 1;
            const thumbnail = /^https?:\/\//i.test(String(episode?.thumbnail || '')) ? String(episode.thumbnail) : '';
            if (!byNumber.has(number) || (!byNumber.get(number).still && thumbnail)) {
                byNumber.set(number, { number, title: title || `Episode ${number}`, still: thumbnail });
            }
        });
        const latestMetadataEpisode = Math.max(0, ...byNumber.keys());
        const declaredEpisodeCount = Math.max(0, Number(media.episodes) || 0);
        const nextAiringEpisode = Math.max(0, Number(media.nextAiringEpisode?.episode) || 0);
        const isAiring = media.status === 'RELEASING';
        const airingLimit = nextAiringEpisode > 0 ? Math.max(1, nextAiringEpisode - 1) : 0;
        const availableEpisodeCount = isAiring
            ? Math.max(1, airingLimit, latestMetadataEpisode)
            : Math.max(1, declaredEpisodeCount, latestMetadataEpisode);
        const episodeCount = declaredEpisodeCount > 0
            ? Math.min(availableEpisodeCount, declaredEpisodeCount)
            : availableEpisodeCount;
        return {
            success: true,
            status: String(media.status || ''),
            episodeCount,
            airedEpisodeCount: episodeCount,
            totalEpisodeCount: declaredEpisodeCount,
            nextAiringEpisode,
            episodes: Array.from(byNumber.values()).filter(episode => episode.number <= episodeCount).sort((a, b) => a.number - b.number)
        };
    } catch (error) {
        console.warn('[Watch Zone] AniList episode artwork request failed:', error.message);
        return { success: false, error: 'Anime episode artwork could not be loaded.' };
    }
});

watchZoneHandle('watch-zone-episodes', async (_event, mediaId, seasonNumber = 1) => {
    const id = Number(mediaId) || 0;
    const season = Math.max(1, Math.min(99, Number(seasonNumber) || 1));
    if (!id) return { success: false, error: 'Invalid show.' };
    try {
        const data = await watchZoneTmdb(`/tv/${id}/season/${season}`);
        const episodes = (Array.isArray(data.episodes) ? data.episodes : []).map(episode => ({
            number: Number(episode.episode_number) || 0,
            title: String(episode.name || `Episode ${episode.episode_number}`),
            overview: String(episode.overview || ''),
            still: watchZoneImage(episode.still_path, 'w500')
        })).filter(episode => episode.number > 0);
        return { success: true, episodes };
    } catch (error) {
        console.warn('[Watch Zone] Episode request failed:', error.message);
        return { success: false, error: 'Episode list could not be loaded.' };
    }
});

async function watchZoneReadProgress() {
    try {
        const parsed = JSON.parse(await fsPromises.readFile(watchZoneProgressPath, 'utf8'));
        return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
    } catch (_) { return { items: [] }; }
}
watchZoneHandle('watch-zone-state', async () => ({ success: true, ...(await watchZoneReadProgress()) }));
async function watchZoneWriteProgress(items) {
    await fsPromises.mkdir(path.dirname(watchZoneProgressPath), { recursive: true });
    await fsPromises.writeFile(watchZoneProgressPath, JSON.stringify({ items }), 'utf8');
}
watchZoneHandle('watch-zone-remove-progress', async (event, rawKey) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    try {
        const key = String(rawKey || '').slice(0, 300);
        const state = await watchZoneReadProgress();
        const before = state.items.length;
        state.items = state.items.filter(item => item.key !== key);
        if (state.items.length !== before) await watchZoneWriteProgress(state.items);
        return { success: true, removed: state.items.length !== before };
    } catch (error) {
        console.warn('[Watch Zone] Could not remove progress:', error.message);
        return { success: false };
    }
});
watchZoneHandle('watch-zone-clear-progress', async (event, rawMode) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    try {
        const mode = rawMode === 'cartoon' ? 'cartoon' : rawMode === 'anime' ? 'anime' : 'movie';
        const state = await watchZoneReadProgress();
        const remaining = state.items.filter(item => item.mode !== mode);
        await watchZoneWriteProgress(remaining);
        return { success: true, removed: state.items.length - remaining.length };
    } catch (error) {
        console.warn('[Watch Zone] Could not clear progress:', error.message);
        return { success: false };
    }
});
async function watchZoneSaveProgress(record) {
    if (!record || !['movie', 'anime', 'cartoon'].includes(record.mode)) return;
    const id = Number(record.id) || 0;
    if (!id) return;
    const state = await watchZoneReadProgress();
    const key = `${record.mode}:${id}:${Number(record.season) || 0}:${Number(record.episode) || 0}`;
    const item = {
        key, mode: record.mode, id, slug: String(record.slug || ''), mediaType: record.mediaType === 'tv' ? 'tv' : (record.mode === 'anime' ? 'anime' : 'movie'),
        title: String(record.title || '').slice(0, 200), poster: String(record.poster || '').slice(0, 2048),
        banner: String(record.banner || '').slice(0, 2048), thumbnail: String(record.thumbnail || record.banner || record.poster || '').slice(0, 2048),
        episodeTitle: String(record.episodeTitle || '').slice(0, 200), season: Number(record.season) || 0, episode: Number(record.episode) || 0,
        position: Math.max(0, Number(record.position) || 0), duration: Math.max(0, Number(record.duration) || 0), updatedAt: Date.now()
    };
    const index = state.items.findIndex(existing => existing.key === key);
    if (item.duration > 0 && item.position / item.duration >= 0.97) {
        if (index >= 0) state.items.splice(index, 1);
    } else if (index >= 0) state.items[index] = item;
    else state.items.unshift(item);
    state.items = state.items.filter(existing => existing.duration <= 0 || existing.position / existing.duration < 0.97).slice(0, 40);
    await fsPromises.mkdir(path.dirname(watchZoneProgressPath), { recursive: true });
    await fsPromises.writeFile(watchZoneProgressPath, JSON.stringify({ items: state.items }), 'utf8');
}
watchZoneHandle('watch-zone-save-progress', async (_event, record) => {
    try { await watchZoneSaveProgress(record); return { success: true }; }
    catch (error) { console.warn('[Watch Zone] Could not save progress:', error.message); return { success: false }; }
});
watchZoneHandle('watch-zone-player-metadata', (event, metadata = {}) => {
    if (event.sender !== mainWindow?.webContents || !watchZoneActiveMedia) return { success: false };
    const current = watchZoneActiveMedia;
    if (String(metadata.mode) !== current.mode || Number(metadata.id) !== current.id) return { success: false };
    const episodic = current.mode === 'anime' || current.mediaType === 'tv';
    if (episodic && ((Number(metadata.season) || 1) !== current.season || (Number(metadata.episode) || 1) !== current.episode)) return { success: false };
    const thumbnail = watchZoneUrl(metadata.thumbnail);
    if (thumbnail) current.thumbnail = thumbnail.slice(0, 2048);
    if (metadata.episodeTitle) current.episodeTitle = String(metadata.episodeTitle).slice(0, 200);
    current.episodeNavigation = watchZoneEpisodeNavigation(metadata.episodeNavigation, current);
    watchZonePlayerView?.webContents.send('watch-zone-player-episode-navigation', current.episodeNavigation);
    return { success: true };
});

function watchZoneUrl(value) {
    const candidate = String(value || '').trim();
    if (!/^https?:\/\//i.test(candidate)) return '';
    try { const parsed = new URL(candidate); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''; } catch (_) { return ''; }
}
function watchZoneEpisodeNavigation(raw, media) {
    const episode = Number(media?.episode) || 0;
    const episodic = media?.mode === 'anime' || media?.mode === 'cartoon' || media?.mediaType === 'tv';
    const previous = Number(raw?.previous), next = Number(raw?.next);
    return {
        enabled: episodic && Boolean(raw?.enabled) && Number(raw?.count) > 1,
        previous: Number.isInteger(previous) && previous > 0 && previous < episode ? previous : 0,
        next: Number.isInteger(next) && next > episode && next <= 5000 ? next : 0
    };
}
function watchZoneHeaderObject(value) {
    const result = {};
    if (!value || typeof value !== 'object') return result;
    for (const [key, raw] of Object.entries(value)) {
        const name = String(key).trim();
        const content = String(raw == null ? '' : raw).trim();
        if (name && content && !/[\r\n]/.test(name + content)) result[name] = content;
    }
    return result;
}
function watchZoneResolveHeaders(stream, rawUrl, inherited = {}, context = {}) {
    const server = String(stream?.server || stream?.source || '').toLowerCase();
    const isVidlink = server.startsWith('vidlink') || server === 'milo';
    const defaultHeaders = {};
    if (isVidlink) {
        const id = Number(context.id) || 0;
        const type = context.mediaType === 'tv' ? 'tv' : 'movie';
        const page = id > 0 ? (type === 'tv'
            ? `https://vidlink.pro/tv/${id}/${Math.max(1, Number(context.season) || 1)}/${Math.max(1, Number(context.episode) || 1)}`
            : `https://vidlink.pro/movie/${id}`) : 'https://vidlink.pro/';
        defaultHeaders.Referer = page;
        defaultHeaders.Origin = 'https://vidlink.pro';
        defaultHeaders['X-Playback-Environment'] = 'dash-hevc';
    }
    const headers = {
        ...defaultHeaders,
        ...watchZoneHeaderObject(inherited),
        ...watchZoneHeaderObject(stream?.headers),
        ...watchZoneHeaderObject(stream?.header),
        ...watchZoneHeaderObject(stream?.requestHeaders || stream?.request_headers),
        ...watchZoneHeaderObject(stream?.playlistHeaders)
    };
    const referrerAlias = Object.entries(headers).find(([key]) => key.toLowerCase() === 'referrer')?.[1];
    if (referrerAlias && !Object.keys(headers).some(key => key.toLowerCase() === 'referer')) headers.Referer = referrerAlias;
    for (const key of Object.keys(headers)) if (key.toLowerCase() === 'referrer') delete headers[key];
    const explicitReferer = watchZoneUrl(stream?.referer || stream?.referrer || stream?.referrerUrl || stream?.referrer_url);
    if (explicitReferer) {
        for (const key of Object.keys(headers)) if (key.toLowerCase() === 'referer') delete headers[key];
        headers.Referer = explicitReferer;
    }
    const explicitOrigin = watchZoneUrl(stream?.origin);
    if (explicitOrigin) headers.Origin = new URL(explicitOrigin).origin;
    const findHeader = name => Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || '';
    const url = new URL(rawUrl);
    const referer = String(stream?.referer || stream?.referrer || stream?.referrerUrl || stream?.referrer_url || findHeader('Referer') || `${url.origin}/`);
    let refererOrigin = '';
    try { if (referer) refererOrigin = new URL(referer).origin; } catch (_) {}
    const origin = String(findHeader('Origin') || refererOrigin || url.origin);
    if (!findHeader('User-Agent')) headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
    if (referer && !findHeader('Referer')) headers.Referer = referer;
    if (origin && !findHeader('Origin')) headers.Origin = origin;
    return headers;
}
function watchZoneGetSourceUrl(stream) {
    const iframe = typeof stream?.iframe === 'string' ? stream.iframe : stream?.iframe?.url;
    return watchZoneUrl(stream?.url || stream?.file || stream?.fileUrl || stream?.playbackUrl || stream?.m3u8 || stream?.proxyUrl || stream?.proxy_url || iframe || stream?.iframeUrl || '');
}
function watchZoneIsEmbed(stream, url) {
    const type = String(stream?.type || '').toLowerCase();
    let pathname = '';
    try { pathname = new URL(url).pathname.toLowerCase(); } catch (_) { pathname = String(url || '').toLowerCase(); }
    const directByUrl = /\.(m3u8|mpd|mp4|m4v|webm|mov)$/i.test(pathname);
    const directByType = /\b(hls|dash|mpegurl|mp4|video|stream)\b/i.test(type);
    if (directByUrl || directByType) return false;
    return type === 'embed' || type === 'iframe' || Boolean(stream?.iframe?.url || stream?.iframe || stream?.iframeUrl);
}
function watchZoneCreateMediaUrl(url, headers, kind = 'auto') {
    const id = crypto.randomBytes(12).toString('hex');
    watchZoneMediaEntries.set(id, { url, headers: watchZoneHeaderObject(headers), kind, createdAt: Date.now() });
    while (watchZoneMediaEntries.size > 5000) watchZoneMediaEntries.delete(watchZoneMediaEntries.keys().next().value);
    let extension = '';
    if (kind === 'hls') extension = '.m3u8';
    else if (kind === 'dash') extension = '.mpd';
    else {
        try {
            const candidate = path.extname(new URL(url).pathname).toLowerCase();
            if (/^\.(?:m3u8?|mpd|dash|vtt|srt|mp4|m4v|m4s|webm|mov|ts|bin)$/.test(candidate)) extension = candidate;
        } catch (_) {}
    }
    return `${watchZoneMediaOrigin}/watch-zone-media/${watchZoneMediaToken}/${id}${extension}`;
}
function watchZoneEscapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}
function watchZoneDecodeXml(value) {
    return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '\"').replace(/&apos;/g, "'");
}
function watchZoneCreateDashBaseUrl(url, baseUrl, headers) {
    const raw = String(url || '').trim();
    if (!raw || /^(?:data:|skd:|urn:)/i.test(raw)) return raw;
    try {
        const parent = new URL(baseUrl);
        const target = new URL(raw, parent);
        if (!target.search && parent.search && !/^(?:https?:)?\/\//i.test(raw)) target.search = parent.search;
        return `${watchZoneCreateMediaUrl(target.toString(), headers, 'dash-base')}/`;
    } catch (_) { return raw; }
}
function watchZoneRewriteDash(text, baseUrl, headers) {
    let hasBaseUrl = false;
    let output = String(text || '').replace(/(<BaseURL\b[^>]*>)([\s\S]*?)(<\/BaseURL>)/gi, (_match, open, rawValue, close) => {
        const raw = watchZoneDecodeXml(rawValue.trim());
        if (!raw) return `${open}${rawValue}${close}`;
        const local = watchZoneCreateDashBaseUrl(raw, baseUrl, headers);
        if (local === raw) return `${open}${rawValue}${close}`;
        hasBaseUrl = true;
        return `${open}${watchZoneEscapeXml(local)}${close}`;
    });
    output = output.replace(/\b(media|initialization|sourceURL|href)=(['\"])(.*?)\2/gi, (match, name, quote, rawValue) => {
        const raw = watchZoneDecodeXml(rawValue.trim());
        if (!/^(?:https?:)?\/\//i.test(raw)) return match;
        try {
            const target = new URL(raw, baseUrl);
            return `${name}=${quote}${watchZoneEscapeXml(watchZoneCreateMediaUrl(target.toString(), headers, 'auto'))}${quote}`;
        } catch (_) { return match; }
    });
    if (!hasBaseUrl) {
        try {
            const parent = new URL(baseUrl);
            const directory = new URL('.', parent);
            directory.search = parent.search;
            const localBase = watchZoneCreateDashBaseUrl(directory.toString(), baseUrl, headers);
            output = output.replace(/(<MPD\b[^>]*>)/i, `$1<BaseURL>${watchZoneEscapeXml(localBase)}</BaseURL>`);
        } catch (_) {}
    }
    return output;
}
function watchZoneRewriteHls(text, baseUrl, headers) {
    const rewrite = (value, kind = 'auto') => {
        const raw = String(value || '').trim();
        if (!raw || /^(data:|skd:|urn:|#)/i.test(raw)) return value;
        try {
            const parent = new URL(baseUrl);
            const target = new URL(raw, parent);
            if (!target.search && parent.search && !/^https?:\/\//i.test(raw) && !raw.startsWith('//')) target.search = parent.search;
            return watchZoneCreateMediaUrl(target.toString(), headers, kind);
        } catch (_) { return value; }
    };
    let nextUriKind = 'auto';
    return text.split(/\r?\n/).map(line => {
        if (!line.trim()) return line;
        if (line.trimStart().startsWith('#')) {
            const tag = line.trimStart();
            const playlistUri = /^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF|RENDITION-REPORT):/i.test(tag);
            const rewritten = line.replace(/URI="([^"]+)"/gi, (_match, uri) => `URI="${rewrite(uri, playlistUri ? 'hls' : 'auto')}"`);
            if (/^#EXT-X-STREAM-INF:/i.test(tag)) nextUriKind = 'hls';
            return rewritten;
        }
        const kind = nextUriKind;
        nextUriKind = 'auto';
        return rewrite(line.trim(), kind);
    }).join('\n');
}
function watchZoneCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, User-Agent',
        'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
        'Cache-Control': 'no-store'
    };
}
function watchZoneSendFile(response, filePath, contentType, transform = null) {
    fsPromises.readFile(filePath).then(data => {
        const output = typeof transform === 'function' ? Buffer.from(transform(data.toString('utf8')), 'utf8') : data;
        response.writeHead(200, { ...watchZoneCorsHeaders(), 'Content-Type': contentType, 'Content-Length': output.length });
        response.end(output);
    }).catch(() => { response.writeHead(404, watchZoneCorsHeaders()); response.end('Not found'); });
}
function watchZoneHandleMediaRequest(request, response) {
    const requestUrl = new URL(request.url, watchZoneMediaOrigin || 'http://127.0.0.1');
    if (request.method === 'OPTIONS') { response.writeHead(204, watchZoneCorsHeaders()); response.end(); return; }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, watchZoneCorsHeaders()); response.end('Method not allowed'); return; }
    const route = requestUrl.pathname.match(/^\/watch-zone-media\/([a-f0-9]+)\/([a-f0-9]+)(?:\.(?:m3u8?|mpd|dash|vtt|srt|mp4|m4v|m4s|webm|mov|ts|bin))?(?:\/(.*))?$/i);
    if (!route || route[1] !== watchZoneMediaToken) { response.writeHead(404, watchZoneCorsHeaders()); response.end('Not found'); return; }
    const entry = watchZoneMediaEntries.get(route[2]);
    if (!entry || Date.now() - entry.createdAt > 4 * 60 * 60 * 1000) { response.writeHead(404, watchZoneCorsHeaders()); response.end('Media link expired'); return; }
    let upstreamUrl = entry.url;
    if ((entry.kind === 'dash' || entry.kind === 'dash-base') && route[3]) {
        try {
            const target = new URL(decodeURIComponent(route[3]), entry.url);
            target.search = requestUrl.search || new URL(entry.url).search;
            upstreamUrl = target.toString();
        } catch (_) { response.writeHead(400, watchZoneCorsHeaders()); response.end('Invalid media path'); return; }
    }
    const headers = { ...entry.headers };
    if (request.headers.range) headers.Range = request.headers.range;
    const upstream = got.stream(upstreamUrl, {
        headers, retry: { limit: 0 }, timeout: { request: 45000 }, throwHttpErrors: false,
        followRedirect: true
    });
    watchZoneActiveUpstreams.add(upstream);
    const releaseUpstream = () => watchZoneActiveUpstreams.delete(upstream);
    upstream.once('close', releaseUpstream);
    upstream.once('end', releaseUpstream);
    upstream.once('error', releaseUpstream);
    let manifest = false;
    let manifestChunks = [];
    upstream.on('response', upstreamResponse => {
        const contentType = String(upstreamResponse.headers['content-type'] || '').toLowerCase();
        const entryKind = String(entry.kind || '').toLowerCase();
        let pathname = '';
        try { pathname = new URL(upstreamResponse.url || upstreamUrl).pathname.toLowerCase(); } catch (_) {}
        if ((upstreamResponse.statusCode || 0) >= 400) {
            let host = '';
            try { host = new URL(upstreamResponse.url || upstreamUrl).host; } catch (_) {}
            const logKind = entryKind.startsWith('dash') ? 'dash' : entryKind;
            console.warn(`[Watch Zone] IPTV proxy upstream returned ${upstreamResponse.statusCode} for ${logKind} ${host}${pathname}`);
        }
        const hintedHls = entryKind === 'hls' || entryKind === 'm3u8';
        const hintedDash = entryKind === 'dash' || entryKind === 'mpd';
        manifest = hintedHls || hintedDash || /\.m3u8?$/i.test(pathname) || /\.mpd$/i.test(pathname) || contentType.includes('mpegurl') || contentType.includes('dash+xml');
        if (manifest) {
            upstream.pause();
            upstream.on('data', chunk => manifestChunks.push(chunk));
            upstream.on('end', () => {
                const body = Buffer.concat(manifestChunks);
                if (body.length > 8 * 1024 * 1024) { response.writeHead(413, watchZoneCorsHeaders()); response.end('Manifest too large'); return; }
                const finalUrl = upstreamResponse.url || upstreamUrl;
                const isDash = hintedDash || /\.mpd$/i.test(pathname) || contentType.includes('dash+xml');
                const text = body.toString('utf8');
                if (isDash) entry.url = finalUrl;
                const output = isDash
                    ? watchZoneRewriteDash(text, finalUrl, entry.headers)
                    : watchZoneRewriteHls(text, finalUrl, entry.headers);
                response.writeHead(upstreamResponse.statusCode || 200, {
                    ...watchZoneCorsHeaders(),
                    'Content-Type': isDash ? 'application/dash+xml' : 'application/vnd.apple.mpegurl',
                    'Content-Length': Buffer.byteLength(output)
                });
                response.end(request.method === 'HEAD' ? undefined : output);
            });
            upstream.on('error', error => { if (!response.headersSent) response.writeHead(502, watchZoneCorsHeaders()); response.end(error.message); });
            upstream.resume();
            return;
        }
        const passHeaders = { ...watchZoneCorsHeaders() };
        if (entryKind === 'subtitle' && upstreamResponse.statusCode === 200) {
            const chunks = [];
            upstream.on('data', chunk => chunks.push(chunk));
            upstream.on('end', () => {
                let text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
                if (!/^WEBVTT(?:\s|$)/.test(text)) {
                    text = 'WEBVTT\n\n' + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                }
                response.writeHead(200, { ...passHeaders, 'Content-Type': 'text/vtt; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
                response.end(request.method === 'HEAD' ? undefined : text);
            });
            upstream.resume();
            return;
        }
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
            if (upstreamResponse.headers[name]) passHeaders[name.split('-').map((part, index) => index ? part[0].toUpperCase() + part.slice(1) : part).join('-')] = upstreamResponse.headers[name];
        }
        response.writeHead(upstreamResponse.statusCode || 200, passHeaders);
        if (request.method === 'HEAD') { upstream.destroy(); response.end(); }
        else upstream.pipe(response);
    });
    upstream.on('error', error => {
        if (!response.headersSent) response.writeHead(502, watchZoneCorsHeaders());
        if (!response.destroyed) response.end(error.message || 'Upstream request failed');
    });
    response.on('close', () => { if (!upstream.destroyed) upstream.destroy(); });
}
async function watchZoneEnsureMediaServer() {
    if (watchZoneMediaServer && watchZoneMediaOrigin && watchZoneMediaToken) return;
    if (watchZoneMediaServerStarting) return watchZoneMediaServerStarting;
    watchZoneMediaServerStarting = new Promise((resolve, reject) => {
        watchZoneMediaServer = watchZoneHttp.createServer((request, response) => {
            if (!watchZoneHasAccess()) {
                response.writeHead(403, watchZoneCorsHeaders());
                response.end('Watch Zone requires a Premium membership.');
                return;
            }
            const requestUrl = new URL(request.url, 'http://127.0.0.1');
            if (requestUrl.pathname === '/watch-zone-media' || requestUrl.pathname.startsWith('/watch-zone-media/')) {
                watchZoneHandleMediaRequest(request, response);
                return;
            }
            if (requestUrl.pathname.startsWith('/proxy/')) {
                watchZoneHandleMovieApi(request, response);
                return;
            }
            if (requestUrl.searchParams.get('token') !== watchZoneMediaToken) { response.writeHead(404, watchZoneCorsHeaders()); response.end('Not found'); return; }
            if (requestUrl.pathname === '/api/stream') {
                watchZoneHandleMovieApi(request, response);
                return;
            }
            if (/^\/watch\/megaplay\//.test(requestUrl.pathname)) {
                watchZoneHandleAnimeApi(request, response);
                return;
            }
            if (requestUrl.pathname === '/player.html') return watchZoneSendFile(response, path.join(__dirname, 'renderer', 'watch-zone-player.html'), 'text/html; charset=utf-8', html => html.replace('./watch-zone-player.js', `/watch-zone-player.js?token=${watchZoneMediaToken}`));
            if (requestUrl.pathname === '/watch-zone-player.js') return watchZoneSendFile(response, path.join(__dirname, 'renderer', 'watch-zone-player.js'), 'text/javascript; charset=utf-8');
            response.writeHead(404, watchZoneCorsHeaders());
            response.end('Not found');
        });
        watchZoneMediaServer.once('error', reject);
        watchZoneMediaServer.listen(0, '127.0.0.1', () => {
            watchZoneMediaServer.removeListener('error', reject);
            const address = watchZoneMediaServer.address();
            watchZoneMediaOrigin = `http://127.0.0.1:${address.port}`;
            watchZoneMediaToken = crypto.randomBytes(24).toString('hex');
            resolve();
        });
    });
    try { await watchZoneMediaServerStarting; }
    finally { watchZoneMediaServerStarting = null; }
}
function watchZoneInstallPlayerHeaders() {
    const playerSession = session.fromPartition(WATCH_ZONE_PLAYER_PARTITION);
    if (watchZonePlayerSessionReady) return playerSession;
    playerSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
        try {
            const hostname = new URL(details.url).hostname.toLowerCase();
        const matchingHosts = Array.from(watchZoneActiveRequestHeaderMaps.keys())
            .filter(host => hostname === host || hostname.endsWith(`.${host}`))
            .sort((left, right) => right.length - left.length);
            const fromPlayer = Boolean(watchZonePlayerView && details.webContentsId === watchZonePlayerView.webContents.id);
            const isPlayerLibrary = hostname === 'cdn.jsdelivr.net' || hostname === 'cdn.dashjs.org' || hostname === '127.0.0.1' || hostname === 'localhost';
            const selectedHeaders = matchingHosts.length
                ? watchZoneActiveRequestHeaderMaps.get(matchingHosts[0])
                : (fromPlayer && !isPlayerLibrary ? watchZoneActiveRequestHeaders : null);
            if (selectedHeaders) {
                const requestHeaders = { ...details.requestHeaders };
                for (const [name, value] of Object.entries(selectedHeaders)) {
                    for (const key of Object.keys(requestHeaders)) if (key.toLowerCase() === name.toLowerCase()) delete requestHeaders[key];
                    requestHeaders[name] = value;
                }
                callback({ requestHeaders });
            } else callback({ requestHeaders: details.requestHeaders });
        } catch (_) { callback({ requestHeaders: details.requestHeaders }); }
    });
    playerSession.webRequest.onHeadersReceived({ urls: ['https://*/*', 'http://*/*'] }, (details, callback) => {
        const fromPlayer = Boolean(watchZonePlayerView && details.webContentsId === watchZonePlayerView.webContents.id);
        const directIptv = ['iptv', 'cartoon'].includes(watchZoneActiveMedia?.mode);
        if (!fromPlayer || !directIptv || !watchZoneActiveRequestHeaderMaps.has(new URL(details.url).hostname.toLowerCase())) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }
        const responseHeaders = { ...details.responseHeaders };
        for (const name of Object.keys(responseHeaders)) if (/^access-control-(?:allow-origin|allow-credentials|allow-headers)$/i.test(name)) delete responseHeaders[name];
        responseHeaders['Access-Control-Allow-Origin'] = [watchZoneMediaOrigin];
        responseHeaders['Access-Control-Allow-Headers'] = ['Range, Content-Type, Accept'];
        callback({ responseHeaders });
    });
    watchZonePlayerSessionReady = true;
    return playerSession;
}
function watchZoneHidePlayer() {
    if (!watchZonePlayerView || !mainWindow || mainWindow.isDestroyed()) return;
    try {
        const { width, height } = watchZonePlayerView.getBounds();
        watchZonePlayerView.setBounds({ x: -10000, y: -10000, width, height });
    } catch (_) {}
}
function watchZoneClosePlayer(preserveFullscreen = false) {
    if (watchZonePlayerView) {
        try { watchZonePlayerView.webContents.setAudioMuted(true); } catch (_) {}
        try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.removeBrowserView(watchZonePlayerView); } catch (_) {}
        try { watchZonePlayerView.webContents.destroy(); } catch (_) { try { watchZonePlayerView.webContents.close(); } catch (_) {} }
        watchZonePlayerView = null;
    }
    if (!preserveFullscreen) {
        const restoreWindow = watchZonePlayerForcedWindowFullscreen;
        watchZonePlayerFullscreen = false;
        watchZonePlayerForcedWindowFullscreen = false;
        watchZonePlayerNormalBounds = null;
        if (restoreWindow && mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(false);
    }
    watchZoneActiveMedia = null;
    watchZoneActiveRequestHeaders = {};
    watchZoneActiveRequestHosts.clear();
    watchZoneActiveRequestHeaderMaps.clear();
    watchZoneMediaEntries.clear();
    for (const upstream of watchZoneActiveUpstreams) {
        try { upstream.destroy(); } catch (_) {}
    }
    watchZoneActiveUpstreams.clear();
    if (watchZoneMediaServer) {
        try { watchZoneMediaServer.close(); } catch (_) {}
        watchZoneMediaServer = null;
    }
    watchZoneMediaOrigin = '';
    watchZoneMediaToken = '';
}
function watchZoneApplyPlayerBounds(bounds) {
    if (!watchZonePlayerView || !mainWindow || mainWindow.isDestroyed()) return;
    const visible = Boolean(bounds?.visible) && Number(bounds.width) > 60 && Number(bounds.height) > 60;
    if (!visible) {
        if (watchZonePlayerFullscreen) watchZoneSetPlayerFullscreen(false);
        watchZoneHidePlayer();
        return;
    }
    const [windowWidth, windowHeight] = mainWindow.getContentSize();
    if (watchZonePlayerFullscreen) {
        watchZonePlayerView.setBounds({ x: 0, y: 0, width: windowWidth, height: windowHeight });
        return;
    }
    const x = Math.max(0, Math.min(windowWidth - 1, Math.round(Number(bounds.x) || 0)));
    const y = Math.max(0, Math.min(windowHeight - 1, Math.round(Number(bounds.y) || 0)));
    const width = Math.max(1, Math.min(windowWidth - x, Math.round(Number(bounds.width) || 1)));
    const height = Math.max(1, Math.min(windowHeight - y, Math.round(Number(bounds.height) || 1)));
    watchZonePlayerNormalBounds = { x, y, width, height };
    watchZonePlayerView.setBounds(watchZonePlayerNormalBounds);
}
function watchZoneSetPlayerFullscreen(enabled) {
    if (!watchZonePlayerView || !mainWindow || mainWindow.isDestroyed()) return;
    const nextFullscreen = Boolean(enabled);
    if (nextFullscreen && !watchZonePlayerFullscreen) {
        watchZonePlayerNormalBounds = watchZonePlayerView.getBounds();
        watchZonePlayerForcedWindowFullscreen = !mainWindow.isFullScreen();
        watchZonePlayerFullscreen = true;
        if (watchZonePlayerForcedWindowFullscreen) mainWindow.setFullScreen(true);
    } else if (!nextFullscreen && watchZonePlayerFullscreen) {
        watchZonePlayerFullscreen = false;
        if (watchZonePlayerNormalBounds) watchZonePlayerView.setBounds(watchZonePlayerNormalBounds);
        const restoreWindow = watchZonePlayerForcedWindowFullscreen;
        watchZonePlayerForcedWindowFullscreen = false;
        if (restoreWindow) mainWindow.setFullScreen(false);
    }
    if (watchZonePlayerFullscreen) {
        const [width, height] = mainWindow.getContentSize();
        watchZonePlayerView.setBounds({ x: 0, y: 0, width, height });
    }
    try { watchZonePlayerView.webContents.send('watch-zone-player-fullscreen-state', watchZonePlayerFullscreen); } catch (_) {}
}
watchZoneHandle('watch-zone-player-layout', (event, bounds) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    watchZoneApplyPlayerBounds(bounds || {});
    return { success: true };
});
watchZoneHandle('watch-zone-player-close', (event) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    watchZoneClosePlayer();
    return { success: true };
});
watchZoneHandle('watch-zone-player-position', (event) => {
    if (event.sender !== mainWindow?.webContents || !watchZoneActiveMedia) return { success: false, position: 0, duration: 0 };
    return { success: true, position: Math.max(0, Number(watchZoneActiveMedia.position) || 0), duration: Math.max(0, Number(watchZoneActiveMedia.duration) || 0) };
});
ipcMain.on('watch-zone-player-scroll', (event, deltaY) => {
    if (!watchZonePlayerView || event.sender !== watchZonePlayerView.webContents || !mainWindow || mainWindow.isDestroyed()) return;
    const delta = Math.max(-1200, Math.min(1200, Number(deltaY) || 0));
    if (delta) mainWindow.webContents.send('watch-zone-scroll', delta);
});
ipcMain.on('watch-zone-player-progress', (event, progress) => {
    if (!watchZonePlayerView || event.sender !== watchZonePlayerView.webContents || !watchZoneActiveMedia) return;
    watchZoneActiveMedia.position = Math.max(0, Number(progress?.position) || 0);
    watchZoneActiveMedia.duration = Math.max(0, Number(progress?.duration) || 0);
    watchZoneSaveProgress({ ...watchZoneActiveMedia, position: progress?.position, duration: progress?.duration }).catch(() => {});
});
ipcMain.on('watch-zone-player-fullscreen', (event, enabled) => {
    if (watchZonePlayerView && event.sender === watchZonePlayerView.webContents) watchZoneSetPlayerFullscreen(enabled);
});
ipcMain.on('watch-zone-player-episode', (event, direction) => {
    if (!watchZonePlayerView || event.sender !== watchZonePlayerView.webContents || !mainWindow || mainWindow.isDestroyed()) return;
    const media = watchZoneActiveMedia;
    const navigation = media?.episodeNavigation;
    if (!navigation?.enabled || (direction !== -1 && direction !== 1)) return;
    const episode = direction === -1 ? navigation.previous : navigation.next;
    if (!episode) return;
    mainWindow.webContents.send('watch-zone-episode-step', { mode: media.mode, id: media.id, season: media.season, fromEpisode: media.episode, episode });
});
ipcMain.on('watch-zone-player-close', (event) => {
    if (watchZonePlayerView && event.sender === watchZonePlayerView.webContents) watchZoneClosePlayer();
});

async function watchZoneResolvePlayback(input) {
    if (input.mode === 'cartoon') {
        if (!/^[a-z0-9-]+$/.test(String(input.slug))) throw new Error('Invalid cartoon series');
        const data = await watchZoneTopCartoons.getSeriesEpisodes(input.slug);
        const episode = data.episodes[(Number(input.episode) || 1) - 1];
        if (!episode) throw new Error('No episode available for this series.');
        const extracted = await watchZoneTopCartoons.extractCartoon(episode.slug);
        const url = watchZoneUrl(extracted.video.url);
        if (!url || !/\.mp4(?:\?|$)/i.test(url)) throw new Error('No playable MP4 returned.');
        return { stream: { url, type: 'mp4', headers: extracted.video.headers, direct: true, embed: false }, subtitles: [], server: 'Top Cartoons', sources: [{ index: 0, label: 'Top Cartoons' }], selectedSourceIndex: 0, variants: [], selectedVariantIndex: 0 };
    }
    const mode = input.mode === 'anime' ? 'anime' : input.mode === 'iptv' ? 'iptv' : 'movie';
    await watchZoneEnsureMediaServer();
    if (mode === 'iptv') {
        const resolved = await watchZoneIptvGetStream(input.channelName || input.id, input.sourceIndex);
        const stream = {
            ...resolved.stream,
            label: resolved.selectedSource.name,
            quality: '',
            embed: false
        };
        const sources = resolved.availableSources.map(source => ({
            index: source.serverIndex, label: source.name, quality: '', embed: false
        }));
        return {
            stream, subtitles: [], server: resolved.selectedSource.name,
            sources, selectedSourceIndex: resolved.serverIndex,
            variants: [], selectedVariantIndex: 0, mode
        };
    }
    const id = Number(input.id) || 0;
    if (!id) throw new Error('Invalid title.');
    let payload;
    if (mode === 'anime') {
        const audio = input.audio === 'dub' ? 'dub' : 'sub';
        const episode = Math.max(1, Math.min(5000, Number(input.episode) || 1));
        const animeUrl = new URL(`/watch/megaplay/${id}/${episode}/${audio}`, watchZoneMediaOrigin);
        animeUrl.searchParams.set('token', watchZoneMediaToken);
        payload = await watchZoneFetchJson(animeUrl.toString(), { timeout: { request: 60000 }, retry: { limit: 0 } });
    } else {
        const mediaType = input.mediaType === 'tv' ? 'tv' : 'movie';
        const url = new URL('/api/stream', watchZoneMediaOrigin);
        url.searchParams.set('token', watchZoneMediaToken);
        url.searchParams.set('tmdbId', String(id));
        url.searchParams.set('type', mediaType);
        if (mediaType === 'tv') {
            url.searchParams.set('season', String(Math.max(1, Number(input.season) || 1)));
            url.searchParams.set('episode', String(Math.max(1, Number(input.episode) || 1)));
        }
        payload = await watchZoneFetchJson(url.toString(), { timeout: { request: 60000 }, retry: { limit: 0 } });
    }
    const inheritedHeaders = {
        ...watchZoneHeaderObject(payload?.headers),
        ...watchZoneHeaderObject(payload?.requestHeaders),
        ...watchZoneHeaderObject(payload?.request_headers)
    };
    const streams = Array.isArray(payload?.streams) ? payload.streams : Array.isArray(payload?.sources) ? payload.sources : [];
    const candidates = streams.map((stream, index) => {
        const url = watchZoneGetSourceUrl(stream);
        if (!url) return null;
        return {
            index,
            url,
            headers: watchZoneResolveHeaders(stream, url, inheritedHeaders, { id, mediaType: input.mediaType, season: input.season, episode: input.episode }),
            type: String(stream?.type || '').toLowerCase(),
            label: String(stream?.server || stream?.source || stream?.provider || stream?.quality || `Source ${index + 1}`),
            quality: String(stream?.quality || ''),
            embed: watchZoneIsEmbed(stream, url),
            subtitles: Array.isArray(stream?.subtitles) ? stream.subtitles : []
        };
    }).filter(Boolean);
    const requestedSourceIndex = input.sourceIndex === undefined || input.sourceIndex === null || input.sourceIndex === '' ? NaN : Number(input.sourceIndex);
    if (mode === 'movie') candidates.sort((a, b) => Number(/^milo\b/i.test(b.label)) - Number(/^milo\b/i.test(a.label)));
    const requestedStream = Number.isInteger(requestedSourceIndex) ? candidates.find(candidate => candidate.index === requestedSourceIndex) : null;
    const stream = requestedStream || candidates.find(candidate => !candidate.embed) || candidates[0];
    if (!stream) throw new Error('No playable source was returned for this title.');
    const allSubtitles = [...(Array.isArray(payload?.subtitles) ? payload.subtitles : []), ...stream.subtitles];
    const subtitles = allSubtitles.map((item, index) => {
        const url = watchZoneUrl(item?.url || item?.file || '');
        if (!url) return null;
        return {
            url,
            label: String(item?.label || item?.language || item?.lang || `Subtitle ${index + 1}`),
            language: String(item?.srclang || item?.lang || item?.language || 'und'),
            headers: watchZoneResolveHeaders(item, url, stream.headers, { id, mediaType: input.mediaType, season: input.season, episode: input.episode })
        };
    }).filter(Boolean);
    const sources = candidates.map(candidate => ({ index: candidate.index, label: candidate.label, quality: candidate.quality, embed: candidate.embed }));
    return { stream, subtitles, server: stream.label, mode, sources, selectedSourceIndex: stream.index, variants: [], selectedVariantIndex: 0 };
}

watchZoneHandle('watch-zone-play', async (event, input = {}) => {
    try {
        const { stream, subtitles, server, sources, selectedSourceIndex, variants = [], selectedVariantIndex = 0 } = await watchZoneResolvePlayback(input);
        if (!watchZoneHasAccess()) return { success: false, error: 'Watch Zone requires a Premium membership.' };
        const parent = mainWindow;
        if (!parent || parent.isDestroyed()) throw new Error('The main app window is unavailable.');
        const preservePlayerFullscreen = watchZonePlayerFullscreen;
        watchZoneClosePlayer(preservePlayerFullscreen);
        await watchZoneEnsureMediaServer();
        if (!watchZoneHasAccess()) {
            watchZoneClosePlayer();
            return { success: false, error: 'Watch Zone requires a Premium membership.' };
        }
        watchZoneMediaEntries.clear();
        watchZoneInstallPlayerHeaders();
        watchZoneActiveRequestHeaders = stream.headers;
        watchZoneActiveRequestHosts = new Set();
        watchZoneActiveRequestHeaderMaps = new Map();
        const bindRequestHeaders = (url, headers) => {
            try {
                const host = new URL(url).hostname.toLowerCase();
                watchZoneActiveRequestHosts.add(host);
                watchZoneActiveRequestHeaderMaps.set(host, headers);
            } catch (_) {}
        };
        bindRequestHeaders(stream.url, stream.headers);
        const proxiedVariants = variants.map(variant => {
            bindRequestHeaders(variant.url, variant.headers);
            const variantPath = (() => { try { return new URL(variant.url).pathname.toLowerCase(); } catch (_) { return String(variant.url || '').toLowerCase(); } })();
            const variantType = /dash|mpd/i.test(variant.type) || /\.mpd(?:$|\?)/i.test(variantPath) ? 'dash'
                : (/hls|m3u8|mpegurl/i.test(variant.type) || /\.m3u8?(?:$|\?)/i.test(variantPath) ? 'hls' : 'direct');
            return {
                index: variant.index, field: variant.field, label: variant.label, type: variant.type,
                url: watchZoneCreateMediaUrl(variant.url, variant.headers, variantType)
            };
        });
        subtitles.forEach(subtitle => bindRequestHeaders(subtitle.url, subtitle.headers));
        const sourcePath = (() => { try { return new URL(stream.url).pathname.toLowerCase(); } catch (_) { return stream.url.toLowerCase(); } })();
        const sourceType = /dash|mpd/i.test(stream.type) || /\.mpd(?:$|\?)/i.test(sourcePath) ? 'dash'
            : (/hls|m3u8|mpegurl/i.test(stream.type) || /\.m3u8?(?:$|\?)/i.test(sourcePath) ? 'hls' : 'direct');
        const selectedVariant = proxiedVariants.find(variant => Number(variant.index) === Number(selectedVariantIndex));
        const playerStreamUrl = stream.embed || stream.direct ? stream.url : (selectedVariant?.url || watchZoneCreateMediaUrl(stream.url, stream.headers, sourceType));
        const playerSubtitles = subtitles.map(subtitle => ({
            ...subtitle,
            url: watchZoneCreateMediaUrl(subtitle.url, subtitle.headers, 'subtitle'),
            headers: undefined
        }));
        watchZoneActiveMedia = {
            mode: input.mode === 'anime' ? 'anime' : input.mode === 'iptv' ? 'iptv' : input.mode === 'cartoon' ? 'cartoon' : 'movie', id: Number(input.id) || 0, slug: String(input.slug || ''),
            mediaType: input.mode === 'iptv' ? 'iptv' : input.mediaType === 'tv' ? 'tv' : (input.mode === 'anime' ? 'anime' : 'movie'),
            title: String(input.title || '').slice(0, 200), poster: String(input.poster || '').slice(0, 2048), banner: String(input.banner || '').slice(0, 2048),
            thumbnail: String(input.thumbnail || input.banner || input.poster || '').slice(0, 2048), episodeTitle: String(input.episodeTitle || '').slice(0, 200),
            season: input.mode === 'anime' || input.mediaType === 'tv' ? (Number(input.season) || 1) : 0,
            episode: input.mode === 'anime' || input.mediaType === 'tv' ? (Number(input.episode) || 1) : 0,
            position: Math.max(0, Number(input.startPosition) || 0), duration: 0
        };
        watchZoneActiveMedia.episodeNavigation = watchZoneEpisodeNavigation(input.episodeNavigation, watchZoneActiveMedia);
        watchZonePlayerView = new BrowserView({ webPreferences: {
            // Episode navigation stays in the main renderer; the player sends only direction.
            preload: gameZonePlayerPreload('watch'),
            partition: WATCH_ZONE_PLAYER_PARTITION,
            nodeIntegration: false, contextIsolation: true, sandbox: true
        }});
        parent.addBrowserView(watchZonePlayerView);
        watchZoneHidePlayer();
        watchZonePlayerView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        watchZonePlayerView.webContents.on('before-input-event', (inputEvent, input) => {
            if (input.type !== 'keyDown' || input.isAutoRepeat) return;
            const key = String(input.key || '').toLowerCase();
            if (key === 'f') {
                inputEvent.preventDefault();
                watchZoneSetPlayerFullscreen(!watchZonePlayerFullscreen);
            } else if (key === 'escape' && watchZonePlayerFullscreen) {
                inputEvent.preventDefault();
                watchZoneSetPlayerFullscreen(false);
            }
        });
        watchZonePlayerView.webContents.on('will-navigate', (navigationEvent, targetUrl) => {
            if (!targetUrl.startsWith(`${watchZoneMediaOrigin}/player.html`)) navigationEvent.preventDefault();
        });
        await watchZonePlayerView.webContents.loadURL(`${watchZoneMediaOrigin}/player.html?token=${watchZoneMediaToken}`);
        watchZonePlayerView.webContents.send('watch-zone-player-source', {
            url: playerStreamUrl, type: stream.embed ? 'embed' : sourceType, label: server, quality: stream.quality,
            embed: stream.embed, headers: {}, playback: stream.playback || null,
            drm: stream.keyId && stream.key ? { keyId: stream.keyId, key: stream.key } : null,
            subtitles: playerSubtitles, startPosition: Math.max(0, Number(input.startPosition) || 0),
            title: watchZoneActiveMedia.title, episodeNavigation: watchZoneEpisodeNavigation(input.episodeNavigation, watchZoneActiveMedia)
        });
        if (watchZonePlayerFullscreen) {
            const [width, height] = parent.getContentSize();
            watchZonePlayerView.setBounds({ x: 0, y: 0, width, height });
            watchZonePlayerView.webContents.send('watch-zone-player-fullscreen-state', true);
        }
        return {
            success: true, server, sources, selectedSourceIndex,
            variants: proxiedVariants.map(({ index, field, label, type }) => ({ index, field, label, type })),
            selectedVariantIndex
        };
    } catch (error) {
        watchZoneClosePlayer();
        console.warn('[Watch Zone] Playback source failed:', error.message);
        return { success: false, error: error.message || 'Playback source could not be loaded.' };
    }
});

app.on('before-quit', () => {
    watchZoneClosePlayer();
    if (watchZoneMediaServer) {
        try { watchZoneMediaServer.close(); } catch (_) {}
        watchZoneMediaServer = null;
    }
});



// Download a remote PDF to a temp file and return a file:// URL (Help PDF viewer).
ipcMain.handle('help-download-pdf', async (event, url) => {
    try {
        const tmp = path.join(app.getPath('temp'), 'gzqa_drm_instructions.pdf');
        const buf = await got(url, { timeout: { request: 30000 } }).buffer();
        await fs.promises.writeFile(tmp, buf);
        return { success: true, url: 'file:///' + tmp.replace(/\\/g, '/') };
    } catch (e) { return { success: false, error: e.message }; }
});

// GameZoneQA remote endpoints — kept in compiled main.jsc, not the plain renderer.
const GZ_ANNOUNCEMENT_URL = 'http://209.46.127.241/gamezonejson/Announcement.txt';
const GZ_HELP_JSON_URL = 'http://209.46.127.241/gamezonejson/help.txt';
const GZ_HELP_FALLBACK = [{ name: 'DRM Written Instructions', description: 'Step-by-step PDF guide', download_url: 'https://www.dropbox.com/scl/fi/ylojso6qiekb1d53odnua/DRM-WRITTEN-INSTRUCTIONS.pdf?rlkey=07m0gli2z2290qcstmik836p7&st=oduqy9xx&dl=1' }];

// Home announcements — raw text fetched here so the URL stays out of renderer source.
ipcMain.handle('home-get-announcements', async () => {
    try { return { success: true, text: await got(GZ_ANNOUNCEMENT_URL, { timeout: { request: 15000 } }).text() }; }
    catch (e) { return { success: false, error: e.message }; }
});

// Help guides — fetch + parse the JSON list here; renderer only gets the items.
ipcMain.handle('help-get-items', async () => {
    try {
        const data = await got(GZ_HELP_JSON_URL, { timeout: { request: 15000 } }).json();
        const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : null);
        return { success: true, items: (items && items.length) ? items : GZ_HELP_FALLBACK };
    } catch (e) { return { success: true, items: GZ_HELP_FALLBACK, error: e.message }; }
});

// Probe a help media URL's Content-Type to decide pdf vs video — needed for links
// without a file extension (e.g. hidrive/dropbox API download URLs).
ipcMain.handle('help-probe-url', async (event, url) => {
    const sniff = (ct) => {
        ct = String(ct || '').toLowerCase();
        if (ct.includes('pdf')) return 'pdf';
        if (ct.startsWith('video/') || ct.includes('mp4') || ct.includes('webm') || ct.includes('matroska') || ct.includes('quicktime') || ct.includes('x-msvideo')) return 'video';
        if (ct.startsWith('image/')) return 'image';
        return 'unknown';
    };
    let ct = '';
    try { const r = await got(url, { method: 'HEAD', timeout: { request: 12000 }, throwHttpErrors: false, followRedirect: true }); ct = r.headers['content-type'] || ''; } catch (e) {}
    let kind = sniff(ct);
    if (kind === 'unknown') {
        // Some hosts reject HEAD — try a tiny ranged GET instead.
        try { const r2 = await got(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, timeout: { request: 12000 }, throwHttpErrors: false, followRedirect: true }); ct = r2.headers['content-type'] || ''; kind = sniff(ct); } catch (e) {}
    }
    return { success: true, kind, contentType: String(ct).toLowerCase() };
});

// Product Library — category JSON + a base host for relative download filenames.
const GZ_PRODUCT_URL = 'http://209.46.127.241/gamezonejson/Product Library.json';
const GZ_PRODUCT_BASE = 'http://209.46.127.241/software/';

function gzResolveProductUrl(raw) {
    if (!raw || String(raw).trim().toLowerCase() === 'invalid') return null;
    const full = /^https?:\/\//i.test(raw) ? raw : (GZ_PRODUCT_BASE + raw);
    try { return new URL(full).href; } catch (e) { return null; } // normalises/encodes spaces
}

ipcMain.handle('product-get-items', async () => {
    if (!isUserPremium) return { success: false, message: 'Premium feature only.', data: [] };
    try {
        const data = await robustFetchJson(GZ_PRODUCT_URL);
        const items = [];
        for (const category of Object.keys(data || {})) {
            const arr = Array.isArray(data[category]) ? data[category] : [];
            for (const it of arr) {
                items.push({
                    title: it.title || 'Untitled',
                    image: it.image || '',
                    description: it.description || '',
                    category,
                    download_url: gzResolveProductUrl(it.download_url)
                });
            }
        }
        return { success: true, items };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('product-download-file', async (event, { url, savePath }) => {
    if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
    try {
        event.sender.send('product-download-status', { status: 'downloading', message: 'Starting download...' });
        await new Promise((resolve, reject) => {
            const stream = got.stream(url);
            stream.on('downloadProgress', (p) => event.sender.send('product-download-progress', p));
            stream.pipe(fs.createWriteStream(savePath)).on('finish', resolve).on('error', reject);
        });
        event.sender.send('product-download-status', { status: 'success', message: 'Download Complete!' });
        return { success: true };
    } catch (e) {
        if (fs.existsSync(savePath)) { try { fs.unlinkSync(savePath); } catch (err) {} }
        event.sender.send('product-download-status', { status: 'error', message: `Error: ${e.message}` });
        return { success: false };
    }
});

// Steam *client* auto-update toggle via steam.cfg in the Steam root.
const STEAM_CFG_CONTENT = 'BootStrapperInhibitAll=Enable\r\nBootStrapperForceSelfUpdate=Disable\r\n';
async function gzSteamRoot() {
    if (!detectedSteamPath || !fs.existsSync(path.join(detectedSteamPath, 'steam.exe'))) detectedSteamPath = await findSteamPath();
    return (detectedSteamPath && fs.existsSync(path.join(detectedSteamPath, 'steam.exe'))) ? detectedSteamPath : null;
}
ipcMain.handle('get-steam-cfg-state', async () => {
    try {
        const root = await gzSteamRoot();
        if (!root) return { success: false, enabled: false, message: 'Steam installation not found.' };
        const cfgPath = path.join(root, 'steam.cfg');
        let enabled = false;
        if (fs.existsSync(cfgPath)) enabled = /BootStrapperInhibitAll\s*=\s*Enable/i.test(fs.readFileSync(cfgPath, 'utf8'));
        return { success: true, enabled };
    } catch (e) { return { success: false, enabled: false, message: e.message }; }
});
ipcMain.handle('set-steam-cfg-state', async (event, enable) => {
    try {
        const root = await gzSteamRoot();
        if (!root) return { success: false, message: 'Steam installation not found.' };
        const cfgPath = path.join(root, 'steam.cfg');
        if (enable) {
            fs.writeFileSync(cfgPath, STEAM_CFG_CONTENT, 'utf8');
            return { success: true, enabled: true, message: 'Steam auto-update disabled (steam.cfg created).' };
        }
        if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
        return { success: true, enabled: false, message: 'Steam auto-update enabled (steam.cfg removed).' };
    } catch (e) {
        const msg = (e.code === 'EPERM' || e.code === 'EACCES') ? 'Access denied — run the app as Administrator to change this.' : e.message;
        return { success: false, message: msg };
    }
});

// --------------------------- DRM UNLOCKER MODULE ---------------------------
(function setupDrmModule() {
    const { net } = require('electron');
    const fsp = fs.promises;
    let sudo = null;
    try { sudo = require('@vscode/sudo-prompt'); } catch (e) { sudo = null; }

    const DRM_PATH_CONFIG = path.join(app.getPath('userData'), 'drm_game_path.txt');
    const SECRET_KEY = crypto.scryptSync('MySuperSecretPassword_ChangeMe', 'salt', 32);
    const ALGORITHM = 'aes-256-cbc';
    const SUDO_OPTIONS = { name: 'GameZoneQA Unlocker' };

    const URLS = {
        STEAM_STABLE: 'https://www.dropbox.com/scl/fi/4kweyu51eth75tur09i8t/steam_api64.dll?rlkey=6gyh76kfbpcw4n6bpqtklcslg&st=u91tqi3m&dl=1',
        STEAM_V1: 'https://www.dropbox.com/scl/fi/77lhya9a6cc98h3z54ggh/steam_api64.dll?rlkey=rx7a1xzrbcux8qa0xn3x9nr92&st=ojqhd2ee&dl=1',
        STEAM_V2: 'https://www.dropbox.com/scl/fi/y5tda6tl7c4kyvgk61mjw/SteamAPI_V2.zip?rlkey=pvnok1dvadkm1j63rgfqpvex9&st=77v1t3nm&dl=1',
        STEAM_V3: 'https://www.dropbox.com/scl/fi/qz3n2ctrs9m9t1nsxmmep/coldloader.zip?rlkey=o7vvu1z3rj1g0q8j8xnj7zi2o&st=ja15bljy&dl=1',
        STEAM_V4: 'https://www.dropbox.com/scl/fi/fx4ofa4lglt5nf2zolyvl/reyaloader.zip?rlkey=ee4eit63lyjv1nqjypgv6wor4&st=6jp6tscv&dl=1',
        CAPCOM: 'https://www.dropbox.com/scl/fi/wax7zg1yfp191bje4o8zy/capcom.zip?rlkey=rk1jk6l3owep9f82ddicm1p13&st=t7b8ydsk&dl=1',
        UBISOFT: 'https://www.dropbox.com/scl/fi/03gibv4bj2ya5ecnoxy2l/UbiSoftGame.zip?rlkey=t226e974ielm7ndd7y03q3wzd&st=6045sitl&dl=1',
        FC25: 'https://www.dropbox.com/scl/fi/n5waxrhyin8xclvku5ro2/BypassFC25.zip?rlkey=ouky6xcha19qexnhq6dh9euy0&st=4nqccl3f&dl=1',
        FC26: 'https://www.dropbox.com/scl/fi/osexg63gknh4qiwn8y7lj/BypassFC26.zip?rlkey=rl7kfy8opunycmebp7mmj4ufl&st=5ifafpsi&dl=1',
        NFL26: 'https://www.dropbox.com/scl/fi/wdjm9xdej8kzetn0mv42h/BypassNFL26.zip?rlkey=zu4d487kwc20mi4zflu2vgv99&st=u2apojrh&dl=1',
        NFS_UNBOUND: 'https://www.dropbox.com/scl/fi/mx03exw5z5yp0hp90ldn5/BypassNFSUnbound.zip?rlkey=vqf2cumd1nav4m0ouz45ksnb4&st=040wte7n&dl=1'
    };

    let gamePath = null;
    let ticketWatcher = null;
    let drmSteamPath = null;

    const anonymize = (text) => {
        if (!text || typeof text !== 'string') return text;
        let clean = text;
        if (gamePath) { clean = clean.split(gamePath).join('<GameFolder>'); clean = clean.split(gamePath.replace(/\\/g, '/')).join('<GameFolder>'); }
        const home = app.getPath('home'); clean = clean.split(home).join('<UserPath>');
        return clean;
    };
    const sanitize = (err) => {
        const msg = (err && err.message) || '';
        if (msg.includes('EPERM') || msg.includes('EACCES')) return 'Access denied. Try running as Administrator.';
        if (msg.includes('ENOENT')) return 'Required file or directory not found.';
        return `System Error: ${anonymize(msg)}`;
    };
    const send = (message, type = 'info') => { if (mainWindow) mainWindow.webContents.send('drm-status-update', anonymize(message), type); };
    const sendPath = () => {
        if (!mainWindow) return;
        const isValid = !!(gamePath && fs.existsSync(gamePath));
        mainWindow.webContents.send('drm-current-path', { displayString: isValid ? gamePath : '', isValid });
    };
    const getGameDir = (p) => { if (!p) return null; try { return fs.statSync(p).isFile() ? path.dirname(p) : p; } catch (e) { return null; } };
    const getTokenInputType = (filePath) => {
        const ext = path.extname(String(filePath || '')).toLowerCase();
        if (ext === '.reya' || ext === '.zip') return ext.slice(1);
        return null;
    };
    const reyaZipDialogOptions = (title) => ({
        title,
        filters: [{ name: 'Reya or ZIP Files', extensions: ['reya', 'zip'] }],
        properties: ['openFile']
    });
    const extractDroppedZipToGameRoot = async (zipPath, root) => {
        if (!root || !fs.existsSync(root)) throw new Error('Game root folder is invalid or inaccessible.');
        send(`Extracting ${path.basename(zipPath)} to game folder root...`, 'info');
        await extractZip(zipPath, { dir: path.resolve(root) });
        return { success: true, message: 'ZIP extracted to game folder root successfully.' };
    };

    async function findFolderRecursive(start, target) {
        try {
            for (const entry of await fsp.readdir(start, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    const full = path.join(start, entry.name);
                    if (entry.name.toLowerCase() === target.toLowerCase()) return full;
                    const r = await findFolderRecursive(full, target); if (r) return r;
                }
            }
        } catch (e) { return null; }
        return null;
    }
    async function findFileRecursive(start, target) {
        try {
            for (const f of await fsp.readdir(start, { withFileTypes: true })) {
                const full = path.join(start, f.name);
                if (f.isDirectory()) { const r = await findFileRecursive(full, target); if (r) return r; }
                else if (f.name.toLowerCase() === target.toLowerCase()) return full;
            }
        } catch (e) { return null; }
        return null;
    }
    async function findGameBinariesWin64(start) {
        try {
            for (const entry of await fsp.readdir(start, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    const full = path.join(start, entry.name);
                    const bw = path.join('Binaries', 'Win64'); const eb = path.join('Engine', 'Binaries', 'Win64');
                    if (full.endsWith(bw) && !full.includes(eb)) return full;
                    const r = await findGameBinariesWin64(full); if (r) return r;
                }
            }
        } catch (e) { return null; }
        return null;
    }
    async function backupAndReplace(src, target) {
        try {
            if (fs.existsSync(target)) { const bak = `${target}.bak`; if (!fs.existsSync(bak)) await fsp.copyFile(target, bak); }
            await fsp.copyFile(src, target);
        } catch (err) { throw new Error(`File operation failed: ${err.message}`); }
    }
    function decryptFileContent(buffer) {
        if (buffer.length <= 16) throw new Error('File too small');
        const iv = buffer.slice(0, 16); const data = buffer.slice(16);
        try { const d = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv); return Buffer.concat([d.update(data), d.final()]); }
        catch (e) { throw new Error('Decryption failed'); }
    }
    async function drmDownload(url, destPath) {
        return new Promise((resolve, reject) => {
            const run = (target) => {
                const req = net.request(target);
                req.on('response', (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return run(res.headers.location);
                    if (res.statusCode !== 200) return reject(new Error('Download failed'));
                    const ws = fs.createWriteStream(destPath);
                    res.pipe(ws);
                    ws.on('finish', () => ws.close(resolve));
                    ws.on('error', () => { fs.unlink(destPath, () => {}); reject(new Error('File write error')); });
                });
                req.on('error', () => reject(new Error('Network error')));
                req.end();
            };
            run(url);
        });
    }

    async function toggleWindowsUpdates(action) {
        if (!sudo) return { success: false, message: 'Elevation helper unavailable.' };
        const batchFilePath = path.join(os.tmpdir(), `update_fix_${Date.now()}.bat`);
        let c = '@echo off\r\n';
        if (action === 'disable') {
            c += 'net stop wuauserv /y >nul 2>&1\r\n';
            c += 'net stop WaaSMedicSvc /y >nul 2>&1\r\n';
            c += 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\wuauserv" /v Start /t REG_DWORD /d 4 /f\r\n';
            c += 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WaaSMedicSvc" /v Start /t REG_DWORD /d 4 /f\r\n';
            c += 'sc failure wuauserv reset= 0 actions= "" >nul 2>&1\r\n';
            c += 'sc failure WaaSMedicSvc reset= 0 actions= "" >nul 2>&1\r\n';
        } else {
            c += 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WaaSMedicSvc" /v Start /t REG_DWORD /d 3 /f\r\n';
            c += 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\wuauserv" /v Start /t REG_DWORD /d 3 /f\r\n';
            c += 'sc config wuauserv start= demand\r\n';
            c += 'net start wuauserv >nul 2>&1\r\n';
        }
        c += 'exit /b 0\r\n';
        try { await fsp.writeFile(batchFilePath, c, 'utf8'); } catch (e) { return { success: false, message: 'Failed to create temporary script.' }; }
        return new Promise((resolve) => {
            sudo.exec(`cmd.exe /c "${batchFilePath}"`, SUDO_OPTIONS, async (error) => {
                try { await fsp.unlink(batchFilePath); } catch (e) {}
                if (error) resolve({ success: false, message: 'Action cancelled or denied by user.' });
                else resolve({ success: true, message: `Windows Updates ${action === 'disable' ? 'Disabled' : 'Enabled'}.` });
            });
        });
    }

    // Steam library helpers (Disable Update feature)
    function drmFindSteamPath() {
        if (process.platform === 'win32') {
            const keys = [
                { key: 'HKCU\\Software\\Valve\\Steam', val: 'SteamPath' },
                { key: 'HKLM\\SOFTWARE\\Valve\\Steam', val: 'InstallPath' },
                { key: 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', val: 'InstallPath' }
            ];
            for (const k of keys) {
                try {
                    const o = execSync(`reg query "${k.key}" /v ${k.val}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
                    const m = o.match(new RegExp(`${k.val}\\s+REG_SZ\\s+(.+)\\s*$`, 'm'));
                    if (m && m[1]) { const p = m[1].trim(); if (fs.existsSync(path.join(p, 'steam.exe'))) return p; }
                } catch (e) {}
            }
            for (const p of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']) if (fs.existsSync(path.join(p, 'steam.exe'))) return p;
            return null;
        }
        return null;
    }
    const getSteamRoot = () => { if (!drmSteamPath) drmSteamPath = drmFindSteamPath(); return drmSteamPath; };
    const getStplugInDir = () => { const r = getSteamRoot(); return r ? path.join(r, 'config', 'stplug-in') : null; };
    function findAllSteamappsDirs() {
        const dirs = new Set(); const root = getSteamRoot();
        if (!root || !fs.existsSync(root)) return [];
        const main = path.join(root, 'steamapps'); if (fs.existsSync(main)) dirs.add(main);
        for (const vdfPath of [path.join(main, 'libraryfolders.vdf'), path.join(root, 'config', 'libraryfolders.vdf')]) {
            try {
                if (!fs.existsSync(vdfPath)) continue;
                const content = fs.readFileSync(vdfPath, 'utf8'); const re = /"path"\s*"([^"]+)"/gi; let m;
                while ((m = re.exec(content)) !== null) { const sa = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps'); if (fs.existsSync(sa)) dirs.add(sa); }
            } catch (e) {}
        }
        return Array.from(dirs);
    }
    const NON_GAME_APP_IDS = new Set(['228980','1070560','1391110','1628350','1493710','2348590','2805730','1245040','1420170','1580130','1887720','858280','930400','961940','1054830','1113280']);
    const findAppManifestFile = (appId) => { for (const dir of findAllSteamappsDirs()) { const f = path.join(dir, `appmanifest_${appId}.acf`); if (fs.existsSync(f)) return f; } return null; };
    const readManifestName = (acf, appId) => { try { const m = fs.readFileSync(acf, 'utf8').match(/"name"\s*"([^"]*)"/i); if (m && m[1].trim()) return m[1].trim(); } catch (e) {} return `AppID ${appId}`; };
    const isFileReadOnly = (p) => { try { return (fs.statSync(p).mode & 0o200) === 0; } catch (e) { return false; } };
    const setManifestReadOnly = (appId, ro) => { const f = findAppManifestFile(appId); if (!f) return { found: false, success: false }; try { fs.chmodSync(f, ro ? 0o444 : 0o666); return { found: true, success: true }; } catch (e) { return { found: true, success: false, error: e.message }; } };

    // Restore the saved game path once the window is up.
    app.whenReady().then(async () => {
        try { if (fs.existsSync(DRM_PATH_CONFIG)) { const saved = (await fsp.readFile(DRM_PATH_CONFIG, 'utf8')).trim(); if (fs.existsSync(saved)) gamePath = saved; } } catch (e) {}
        if (mainWindow) mainWindow.webContents.on('did-finish-load', () => sendPath());
    });

    ipcMain.handle('drm-get-wub-status', async () => new Promise((resolve) => {
        exec('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\wuauserv" /v Start', (error, stdout) => {
            if (error) resolve({ success: false, status: 'enabled' });
            else if (stdout.includes('0x4')) resolve({ success: true, status: 'disabled' });
            else resolve({ success: true, status: 'enabled' });
        });
    }));
    ipcMain.handle('drm-set-wub-state', async (event, action) => { if (!isUserPremium) return { success: false, message: 'Premium feature only.' }; return await toggleWindowsUpdates(action); });

    ipcMain.handle('drm-get-disable-update-games', async () => {
        const stplugIn = getStplugInDir();
        if (!stplugIn || !fs.existsSync(stplugIn)) return { success: false, games: [], message: 'Steam library (stplug-in) not found.' };
        const libraryAppIds = new Set();
        try { for (const f of fs.readdirSync(stplugIn)) { if (!f.toLowerCase().endsWith('.lua')) continue; const id = f.slice(0, -4); if (/^\d+$/.test(id)) libraryAppIds.add(id); } }
        catch (e) { return { success: false, games: [], message: 'Error reading library.' }; }
        if (libraryAppIds.size === 0) return { success: true, games: [], message: 'No library games found.' };
        const games = []; const seen = new Set();
        for (const dir of findAllSteamappsDirs()) {
            let files; try { files = fs.readdirSync(dir); } catch (e) { continue; }
            for (const f of files) {
                const m = /^appmanifest_(\d+)\.acf$/i.exec(f); if (!m) continue;
                const appId = m[1]; if (seen.has(appId) || NON_GAME_APP_IDS.has(appId) || !libraryAppIds.has(appId)) continue;
                seen.add(appId); const acf = path.join(dir, f);
                games.push({ appId, name: readManifestName(acf, appId), readOnly: isFileReadOnly(acf) });
            }
        }
        games.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        return { success: true, games, message: `Found ${games.length} installed games.` };
    });
    ipcMain.handle('drm-set-disable-update', async (event, appId, disable) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        const s = String(appId);
        if (!/^\d+$/.test(s)) return { success: false, message: 'Invalid AppID.' };
        if (!getSteamRoot()) return { success: false, message: 'Steam installation not found.' };
        const r = setManifestReadOnly(s, !!disable);
        if (!r.found) return { success: false, message: `Manifest for AppID ${s} not found.` };
        if (!r.success) return { success: false, message: `Could not change AppID ${s}. ${sanitize({ message: r.error || '' })}` };
        return { success: true, readOnly: !!disable, message: disable ? `Update disabled for AppID ${s}.` : `Update enabled for AppID ${s}.` };
    });

    ipcMain.handle('drm-reset-game-path', async () => { gamePath = null; return { success: true }; });
    ipcMain.handle('drm-get-location', async () => { const isValid = !!(gamePath && fs.existsSync(gamePath)); return { displayString: isValid ? gamePath : '', isValid }; });
    ipcMain.handle('drm-open-game-folder', async () => { if (gamePath && fs.existsSync(gamePath)) await shell.openPath(getGameDir(gamePath)); });
    ipcMain.handle('drm-select-location', async (event, mode = 'folder') => {
        const options = { title: 'Select Game Location' };
        if (mode === 'exe') { options.properties = ['openFile']; options.filters = [{ name: 'Game Executable', extensions: ['exe'] }]; }
        else options.properties = ['openDirectory'];
        const result = await dialog.showOpenDialog(mainWindow, options);
        if (result.canceled || !result.filePaths?.[0]) return;
        gamePath = result.filePaths[0];
        await fsp.writeFile(DRM_PATH_CONFIG, gamePath);
        send('Game path configured successfully.', 'success');
        sendPath();
    });

    ipcMain.handle('drm-process-ea-reya', async (event, filePath) => {
        if (!filePath) {
            const r = await dialog.showOpenDialog(mainWindow, reyaZipDialogOptions('Select EA Sports Token or ZIP File'));
            if (r.canceled || !r.filePaths[0]) return { success: false, message: 'Selection cancelled.' };
            filePath = r.filePaths[0];
        }
        const inputType = getTokenInputType(filePath);
        if (!inputType) return { success: false, message: 'Invalid file format. Use .reya or .zip.' };
        try {
            if (!gamePath) return { success: false, message: 'Please select the game location first.' };
            const root = getGameDir(gamePath);
            if (inputType === 'zip') return await extractDroppedZipToGameRoot(filePath, root);
            if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
            const decrypted = decryptFileContent(await fsp.readFile(filePath));
            const token = decrypted.toString('utf8').trim();
            const cfg = await findFileRecursive(root, 'anadius.cfg');
            if (!cfg) return { success: false, message: 'Config file (anadius.cfg) not found in game directory.' };
            let content = await fsp.readFile(cfg, 'utf8');
            if (!content.includes('PASTE_A_VALID_DENUVO_TOKEN_HERE')) return { success: false, message: "Placeholder 'PASTE_A_VALID_DENUVO_TOKEN_HERE' not found in anadius.cfg." };
            content = content.replace('PASTE_A_VALID_DENUVO_TOKEN_HERE', token);
            await fsp.writeFile(cfg, content, 'utf8');
            return { success: true, message: 'EA Token applied to anadius.cfg successfully.' };
        } catch (err) { return { success: false, message: sanitize(err) }; }
    });

    ipcMain.handle('drm-process-ubisoft-reya', async (event, filePath) => {
        if (!filePath) {
            const r = await dialog.showOpenDialog(mainWindow, reyaZipDialogOptions('Select Ubisoft Token or ZIP File'));
            if (r.canceled || !r.filePaths[0]) return { success: false, message: 'Selection cancelled.' };
            filePath = r.filePaths[0];
        }
        const inputType = getTokenInputType(filePath);
        if (!inputType) return { success: false, message: 'Invalid file format. Use .reya or .zip.' };
        try {
            if (!gamePath) return { success: false, message: 'Please select the game location first.' };
            const root = getGameDir(gamePath);
            if (inputType === 'zip') return await extractDroppedZipToGameRoot(filePath, root);
            if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
            const targetFile = path.join(root, 'activation.reya');
            await fsp.copyFile(filePath, targetFile);
            send('Copied activation.reya to game folder.', 'info');
            const json = JSON.parse(decryptFileContent(await fsp.readFile(targetFile)).toString('utf8'));
            if (!json.DLCIds || !Array.isArray(json.DLCIds) || json.DLCIds.length === 0) return { success: true, message: 'Ubisoft Token Applied. No DLCs found to update.' };
            const ini = await findFileRecursive(root, 'upc_r2.ini');
            if (!ini) return { success: false, message: 'Token applied, but could not find upc_r2.ini' };
            let iniContent = await fsp.readFile(ini, 'utf8');
            const dlcRe = /\r?\n\[DLC\][\s\S]*/;
            if (dlcRe.test(iniContent)) iniContent = iniContent.replace(dlcRe, '');
            iniContent = iniContent.trim() + `\r\n\r\n[DLC]\r\n${json.DLCIds.join('\r\n')}`;
            await fsp.writeFile(ini, iniContent, 'utf8');
            return { success: true, message: 'Ubisoft Token Applied Successfully.' };
        } catch (err) { return { success: false, message: sanitize(err) }; }
    });

    ipcMain.handle('drm-process-reya-file', async (event, filePath) => {
        if (!filePath) {
            const r = await dialog.showOpenDialog(mainWindow, reyaZipDialogOptions('Select Token or ZIP File'));
            if (r.canceled || !r.filePaths[0]) return { success: false, message: 'Selection cancelled.' };
            filePath = r.filePaths[0];
        }
        const inputType = getTokenInputType(filePath);
        if (!inputType) return { success: false, message: 'Invalid file format. Use .reya or .zip.' };
        try {
            if (!gamePath) return { success: false, message: 'Please select the game location first.' };
            const root = getGameDir(gamePath);
            if (inputType === 'zip') return await extractDroppedZipToGameRoot(filePath, root);
            if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
            let targetDir = null;
            const capcom = await findFileRecursive(root, 'dinput8.dll');
            const cold = await findFileRecursive(root, 'coldloader.dll');
            const reya = await findFileRecursive(root, 'reyaloader.dll');
            const steamApi = await findFileRecursive(root, 'steam_api64.dll');
            if (capcom) { targetDir = path.join(path.dirname(capcom), 'steam_settings'); send('Detected CapCom installation.', 'info'); }
            else if (cold) { targetDir = path.join(path.dirname(cold), 'steam_settings'); send('Detected Coldloader installation.', 'info'); }
            else if (reya) { targetDir = path.join(path.dirname(reya), 'steam_settings'); send('Detected Reyaloader installation.', 'info'); }
            else if (steamApi) { targetDir = path.join(path.dirname(steamApi), 'steam_settings'); send('Detected Experimental installation.', 'info'); }
            if (!targetDir) return { success: false, message: 'Could not find loader DLL or steam_api64.dll.' };
            if (fs.existsSync(targetDir)) await fsp.rm(targetDir, { recursive: true, force: true });
            await fsp.mkdir(targetDir, { recursive: true });
            let content = decryptFileContent(await fsp.readFile(filePath)).toString('utf8');
            if (content.includes('account_name=')) content = content.replace(/account_name=.*/g, 'account_name=genshinreya');
            else content = content.replace(/account_steamid=.*/g, '$&\r\naccount_name=genshinreya');
            await fsp.writeFile(path.join(targetDir, 'configs.user.ini'), content, 'utf8');
            let reyaName = path.basename(filePath, '.reya').replace(/\s*\(\d+\)$/, '');
            await fsp.writeFile(path.join(targetDir, 'steam_appid.txt'), reyaName, 'utf8');
            return { success: true, message: 'Token Applied Successfully' };
        } catch (err) { return { success: false, message: sanitize(err) }; }
    });

    ipcMain.handle('drm-start-bypass', async (event, { mode, selection }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        if (!gamePath || !fs.existsSync(gamePath)) return { success: false, message: 'Invalid or missing game path.' };
        const tempDir = app.getPath('temp');
        const root = getGameDir(gamePath);
        const cleanupConflicts = async () => {
            for (const fName of ['coldloader.dll', 'coldloader.ini', 'winmm.dll', 'version.dll']) {
                const fPath = path.join(root, fName);
                if (fs.existsSync(fPath)) { try { await fsp.unlink(fPath); send('Removed conflicting files', 'info'); } catch (e) {} }
            }
        };
        try {
            if (mode === 'steam') {
                send(`Initiating Steam Patch (Version ${selection})...`, 'info');
                if (selection === '1') {
                    await cleanupConflicts();
                    const tempZip = path.join(tempDir, 'bypass_tmp.zip'); const ex = path.join(tempDir, 'bypass_extract');
                    await drmDownload(URLS.STEAM_V2, tempZip);
                    await extractZip(tempZip, { dir: ex });
                    let installed = 0;
                    for (const fileName of ['steam_api64.dll', 'steamclient64.dll']) {
                        const src = path.join(ex, fileName);
                        if (fs.existsSync(src)) { const dest = await findFileRecursive(root, fileName); if (dest) { await backupAndReplace(src, dest); installed++; } else { await fsp.copyFile(src, path.join(root, fileName)); installed++; } }
                    }
                    try { await fsp.rm(ex, { recursive: true, force: true }); } catch (e) {} try { await fsp.unlink(tempZip); } catch (e) {}
                    return installed > 0 ? { success: true, message: 'Experimental Patch Applied Successfully.' } : { success: false, message: 'No patch files found in archive.' };
                } else if (selection === '2') {
                    await cleanupConflicts();
                    const tempZip = path.join(tempDir, 'coldloader_tmp.zip'); const ex = path.join(tempDir, 'coldloader_extract');
                    await drmDownload(URLS.STEAM_V3, tempZip);
                    await extractZip(tempZip, { dir: ex });
                    let installDir = await findGameBinariesWin64(root) || await findFolderRecursive(root, 'bin64') || await findFolderRecursive(root, 'retail') || root;
                    send('Target Game Found', 'info');
                    for (const file of await fsp.readdir(ex)) await backupAndReplace(path.join(ex, file), path.join(installDir, file));
                    try { await fsp.rm(ex, { recursive: true, force: true }); } catch (e) {} try { await fsp.unlink(tempZip); } catch (e) {}
                    return { success: true, message: 'Coldloader Patch Applied Successfully.' };
                } else if (selection === '3') {
                    const tempZip = path.join(tempDir, 'reyaloader_tmp.zip'); const ex = path.join(tempDir, 'reyaloader_extract');
                    await drmDownload(URLS.STEAM_V4, tempZip);
                    await extractZip(tempZip, { dir: ex });
                    let installDir = await findGameBinariesWin64(root) || root;
                    for (const file of await fsp.readdir(ex)) await backupAndReplace(path.join(ex, file), path.join(installDir, file));
                    try { await fsp.rm(ex, { recursive: true, force: true }); } catch (e) {} try { await fsp.unlink(tempZip); } catch (e) {}
                    return { success: true, message: 'Reyaloader Patch Applied Successfully.' };
                } else if (selection === '4') {
                    await cleanupConflicts();
                    const tempZip = path.join(tempDir, 'capcom_tmp.zip'); const ex = path.join(tempDir, 'capcom_extract');
                    await drmDownload(URLS.CAPCOM, tempZip);
                    await extractZip(tempZip, { dir: ex });
                    let installDir = await findGameBinariesWin64(root) || await findFolderRecursive(root, 'bin64') || root;
                    send('Target Game Found', 'info');
                    for (const file of await fsp.readdir(ex)) await backupAndReplace(path.join(ex, file), path.join(installDir, file));
                    try { await fsp.rm(ex, { recursive: true, force: true }); } catch (e) {} try { await fsp.unlink(tempZip); } catch (e) {}
                    try {
                        send('Checking for specific Capcom game patches...', 'info');
                        const jsonUrl = 'https://www.dropbox.com/scl/fi/s1icaqb83ffy88xyfr2l2/.capcom_dinput8.json?rlkey=hyb6ew33bbhs09dgs8iqkfjbt&st=bgu18tx1&dl=1';
                        const jsonTmp = path.join(tempDir, 'capcom_json_tmp.json');
                        await drmDownload(jsonUrl, jsonTmp);
                        const mappings = JSON.parse(await fsp.readFile(jsonTmp, 'utf8'));
                        for (const game of mappings) {
                            const exe = await findFileRecursive(root, game.game_name);
                            if (exe) { send(`Matched ${game.game_name}. Downloading specific update...`, 'info'); const sp = path.join(tempDir, 'capcom_specific_tmp.zip'); await drmDownload(game.download_link, sp); await extractZip(sp, { dir: path.dirname(exe) }); try { await fsp.unlink(sp); } catch (e) {} break; }
                        }
                        try { await fsp.unlink(jsonTmp); } catch (e) {}
                    } catch (e) { send('Failed to check/apply specific Capcom patch, ignoring...', 'warning'); }
                    return { success: true, message: 'CapCom Patch Applied Successfully.' };
                }
            }
            if (mode === 'ubisoft') {
                send('Downloading Ubisoft resources...', 'info');
                const tempZip = path.join(tempDir, 'ubi_tmp.zip');
                await drmDownload(URLS.UBISOFT, tempZip);
                const dbData = await findFileRecursive(root, 'dbdata.dll');
                if (!dbData) { try { await fsp.unlink(tempZip); } catch (e) {} return { success: false, message: 'dbdata.dll not found in game directory. Cannot apply patch.' }; }
                const installDir = path.dirname(dbData); send('Target Game Found', 'info');
                const ex = path.join(tempDir, 'ubi_extract'); await extractZip(tempZip, { dir: ex });
                for (const file of await fsp.readdir(ex)) { const src = path.join(ex, file); if ((await fsp.stat(src)).isFile()) await backupAndReplace(src, path.join(installDir, file)); }
                try { await fsp.rm(ex, { recursive: true, force: true }); } catch (e) {} try { await fsp.unlink(tempZip); } catch (e) {}
                return { success: true, message: 'Ubisoft Patch Applied Successfully.' };
            }
            if (mode === 'ea') {
                const url = URLS[selection.toUpperCase()];
                if (!url) throw new Error(`URL not found for selection: ${selection}`);
                send(`Downloading EA Patch (${selection})...`, 'info');
                const tempZip = path.join(tempDir, 'ea_tmp.zip');
                await drmDownload(url, tempZip);
                send('Installing EA patch...', 'info');
                await extractZip(tempZip, { dir: root });
                try { await fsp.unlink(tempZip); } catch (e) {}
                return { success: true, message: 'EA Patch Applied Successfully.' };
            }
            return { success: false, message: 'Unknown operation mode.' };
        } catch (err) { return { success: false, message: sanitize(err) }; }
    });

    ipcMain.handle('drm-launch-game-process', async (event, mode) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        if (!gamePath || !fs.existsSync(gamePath)) return { success: false, message: 'Invalid game executable.' };
        if (!gamePath.toLowerCase().endsWith('.exe')) return { success: false, message: 'Selected path is not an executable.' };
        const root = getGameDir(gamePath);
        let deleteRegex, watchRegex;
        if (mode === 'ea') { deleteRegex = /^Denuvo_?Ticket.*\.txt$/i; watchRegex = /^Denuvo_?Ticket.*\.txt$/i; }
        else if (mode === 'ubisoft') { deleteRegex = /.*token.*\.txt$/i; watchRegex = /^token_req.*\.txt$/i; }
        else return { success: false, message: 'Unknown launch mode.' };
        try {
            for (const file of await fsp.readdir(root)) {
                if (deleteRegex.test(file)) await fsp.unlink(path.join(root, file));
                else if (mode === 'ubisoft' && (file.toLowerCase() === 'dbdata.json' || file.toLowerCase() === 'activation.reya')) await fsp.unlink(path.join(root, file));
            }
            send('Cleared old token/ticket files.', 'info');
            const proc = spawn(gamePath, [], { detached: true, cwd: root }); proc.unref();
            send(`Game (${mode}) launched. Monitoring...`, 'warning');
            if (ticketWatcher) ticketWatcher.close();
            let capturing = false;
            ticketWatcher = fs.watch(root, async (eventType, filename) => {
                if (capturing) return;
                if (filename && watchRegex.test(filename)) {
                    capturing = true;
                    if (ticketWatcher) { ticketWatcher.close(); ticketWatcher = null; }
                    const ticketPath = path.join(root, filename);
                    setTimeout(async () => {
                        if (fs.existsSync(ticketPath)) {
                            try {
                                const raw = await fsp.readFile(ticketPath, 'utf8');
                                const clean = raw.split(/\r?\n/).filter((line) => { const l = line.trim(); if (!l) return false; if (l.includes('protected by Denuvo')) return false; if (l.toLowerCase().startsWith('exe:')) return false; return true; }).join('\n').trim();
                                mainWindow.webContents.send('drm-ticket-found', clean);
                                send('Captured: Token Successfully', 'success');
                            } catch (e) { send('Error reading new file.', 'error'); }
                        }
                    }, 500);
                }
            });
            return { success: true, message: 'Monitor active.' };
        } catch (err) { return { success: false, message: sanitize(err) }; }
    });

    ipcMain.handle('drm-save-and-open-token', async (event, content) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        if (!content) return { success: false, message: 'No content to save.' };
        try {
            const filePath = path.join(app.getPath('downloads'), 'token.txt');
            await fsp.writeFile(filePath, content, 'utf8');
            await shell.openPath(filePath);
            return { success: true, message: 'File downloaded and opened.' };
        } catch (err) { return { success: false, message: `Failed to save file: ${err.message}` }; }
    });
})();

// --------------------------- GAME LIBRARY MODULE ---------------------------
(function setupGameLibraryModule() {
    const GAMES_JSON_URL = 'https://raw.githubusercontent.com/luamikare/publuaguifest/main/passby/games_gamezone.json';
    const ONLINE_FIX_URL = 'http://209.46.127.241/gamezonejson/Revised Online Game Fix.json';
    const DRM_GAMES_URL = 'http://209.46.127.241/gamezonejson/Revised DRM.json';
    const SWITCH_GAMES_URL = 'http://209.46.127.241/gamezonejson/Switch games.json';

    const DL_BEARER_SECRET = String.fromCharCode(...[102,52,52,51,55,57,56,101,51,56,102,57,50,102,54,100,49,99,100,55,48,101,56,48,97,55,101,97,100,98,101,54,51,101,49,49,99,51,55,48,56,55,97,54,99,50,54,53,98,98,52,48,102,51,48,55,97,102,53,101,52,51,54,48]);
    const DL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArG56xwh9ufgThXRGJ1/c
p32xlGzdHTnJZ2L+gYQ2Xy7NG3hUVqClYn/8vcWXST+9fWHg4YhFoU9ue3h3QvNq
ZSHCwLHPkHojiw6e1l4bJ494vaWn+oQf4R0bb9YseV28xKXV0qJ0DP6leAMDZydU
sMezIb92WXUG5ep4/tyF26AgMvXl1lwdBCFYC2I6wW802CcZ18j+6lnt/+8TPs3B
4aYtdXuw4TboiPT5I+yixohXO1JmQ1RPZuW0fe4loqVEd5p4HSfxyyb9eQdK1nrU
556B8V5/vE4RaMvU0H/ebNIH0aaV42Lhwt9X4VimCq7MVh2++w1kke9ejBlryqvJ
JwIDAQAB
-----END PUBLIC KEY-----`;

    const b64 = (i) => Buffer.from(i).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const bearer = () => {
        const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const p = b64(JSON.stringify({ jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 }));
        const s = b64(crypto.createHmac('sha256', DL_BEARER_SECRET).update(`${h}.${p}`).digest());
        return `${h}.${p}.${s}`;
    };
    async function getSignedDownloadUrl(origin, fileName) {
        const resp = await got(`${origin}/sign?file=${encodeURIComponent(fileName)}`, { headers: { Authorization: `Bearer ${bearer()}` }, throwHttpErrors: false });
        if (resp.statusCode !== 200) throw new Error(`Link issuer returned ${resp.statusCode}`);
        const sh = resp.headers['x-response-signature']; const sig = Array.isArray(sh) ? sh[0] : sh;
        if (!sig) throw new Error('Missing response signature');
        if (!crypto.verify('sha256', Buffer.from(resp.body), DL_PUBLIC_KEY, Buffer.from(sig, 'base64'))) throw new Error('Response signature mismatch (tampered)');
        const data = JSON.parse(resp.body);
        if (!data.url) throw new Error('No URL in issuer response');
        return data.url;
    }
    async function resolveDownloadUrl(rawUrl) {
        const parsed = new URL(rawUrl);
        const isProtected = parsed.pathname.startsWith('/fixes/') && parsed.pathname.toLowerCase().endsWith('.zip') && !parsed.searchParams.has('sig');
        if (!isProtected) return rawUrl;
        const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        if (!fileName) return rawUrl;
        return getSignedDownloadUrl(parsed.origin, fileName);
    }
    const fetchJson = async (url) => { try { return { success: true, data: await robustFetchJson(url) }; } catch (e) { return { success: false, error: e.message }; } };

    ipcMain.handle('gl-fetch-games', async () => { if (!isUserPremium) return []; return fetchJson(GAMES_JSON_URL); });
    ipcMain.handle('gl-fetch-online-fixes', async () => { if (!isUserPremium) return []; return fetchJson(ONLINE_FIX_URL); });
    ipcMain.handle('gl-fetch-drm-games', async () => { if (!isUserPremium) return []; return fetchJson(DRM_GAMES_URL); });
    ipcMain.handle('gl-fetch-switch-games', async () => { if (!isUserPremium) return []; return fetchJson(SWITCH_GAMES_URL); });
    ipcMain.handle('gl-select-directory', async () => {
        const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        return res.canceled ? null : res.filePaths[0];
    });
    async function runGameLibraryPatch(event, { url, gamePath, appId, auto = false }) {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        if (!url) return { success: false, message: 'Missing patch download URL.' };

        let targetPath = gamePath;
        if (auto) {
            if (!appId || !/^\d+$/.test(String(appId))) return { success: false, message: 'Invalid Steam AppID.' };
            if (!detectedSteamPath) detectedSteamPath = await findSteamPath();
            const install = getSteamGameInstall(String(appId));
            if (!install || !install.gameDir) return { success: false, message: 'Installed game folder was not found.' };
            targetPath = install.gameDir;
        }

        if (!targetPath || !fs.existsSync(targetPath)) return { success: false, message: 'Target folder was not found.' };

        const downloadPath = path.join(app.getPath('temp'), `gamezone_patch_${Date.now()}_${crypto.randomUUID()}.zip`);
        try {
            event.sender.send('gl-patch-status', { status: 'downloading', message: 'Downloading files...' });
            const downloadUrl = await resolveDownloadUrl(url);
            await new Promise((resolve, reject) => {
                const stream = got.stream(downloadUrl);
                stream.on('downloadProgress', (p) => event.sender.send('gl-download-progress', p));
                stream.pipe(fs.createWriteStream(downloadPath)).on('finish', resolve).on('error', reject);
            });
            event.sender.send('gl-patch-status', { status: 'extracting', message: 'Extracting files...' });
            await extractZip(downloadPath, { dir: path.resolve(targetPath) });
            event.sender.send('gl-patch-status', {
                status: 'success',
                message: auto ? 'Auto patch applied successfully!' : 'Files applied successfully!'
            });
            return { success: true, gamePath: targetPath };
        } catch (e) {
            event.sender.send('gl-patch-status', { status: 'error', message: e.message });
            return { success: false, message: e.message };
        } finally {
            if (fs.existsSync(downloadPath)) { try { fs.unlinkSync(downloadPath); } catch (err) {} }
        }
    }
    ipcMain.handle('gl-patch-game', async (event, { url, gamePath }) => {
        return runGameLibraryPatch(event, { url, gamePath, auto: false });
    });
    ipcMain.handle('gl-auto-patch-game', async (event, { url, appId }) => {
        return runGameLibraryPatch(event, { url, appId, auto: true });
    });
})();

// --------------------------- ZONE PLAY MODULE -----------------------------
(function setupZonePlayModule() {
    const zonePlayDownloads = new Map();

    function zpSafeName(value, fallback = 'ZonePlay') {
        return String(value || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
    }

    function zpGameId(game) {
        const raw = `${game && game.title || ''}|${game && game.download_url || ''}`;
        return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
    }

    async function zpReadInstalls() {
        try {
            if (!fs.existsSync(ZONE_PLAY_INSTALLS_FILE_INTERNAL)) return {};
            return JSON.parse(await fsPromises.readFile(ZONE_PLAY_INSTALLS_FILE_INTERNAL, 'utf8'));
        } catch (_) {
            return {};
        }
    }

    async function zpWriteInstalls(data) {
        await fsPromises.mkdir(path.dirname(ZONE_PLAY_INSTALLS_FILE_INTERNAL), { recursive: true });
        await fsPromises.writeFile(ZONE_PLAY_INSTALLS_FILE_INTERNAL, JSON.stringify(data || {}, null, 2), 'utf8');
    }

    async function zpPatchInstallRecord(id, patch) {
        if (!id) return null;
        const installs = await zpReadInstalls();
        const key = String(id);
        if (!installs[key]) return null;
        installs[key] = { ...installs[key], ...patch };
        await zpWriteInstalls(installs);
        return installs[key];
    }

    async function zpSweepTempDownloads(tempDownloadDir) {
        try {
            if (!fs.existsSync(tempDownloadDir)) return;
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            const entries = await fsPromises.readdir(tempDownloadDir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(tempDownloadDir, entry.name);
                try {
                    const stat = await fsPromises.stat(full);
                    if (stat.mtimeMs >= cutoff) continue;
                    if (entry.isDirectory()) await fsPromises.rm(full, { recursive: true, force: true });
                    else if (entry.isFile()) await fsPromises.rm(full, { force: true });
                } catch (_) {}
            }
        } catch (_) {}
    }

    function zpGetHeaderFileName(headers, fallback) {
        const disposition = headers && (headers['content-disposition'] || headers.get && headers.get('content-disposition')) || '';
        const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="?([^";]+)"?/i.exec(disposition);
        if (match) {
            try { return zpSafeName(decodeURIComponent(match[1]), fallback); }
            catch (_) { return zpSafeName(match[1], fallback); }
        }
        return fallback;
    }

    function zpParseGofileId(input) {
        const str = String(input || '').trim();
        const direct = /gofilecdn\.eu\.cc\/([a-zA-Z0-9]+)/i.exec(str);
        if (direct) return direct[1];
        const gofile = /gofile\.io\/d\/([a-zA-Z0-9]+)/i.exec(str);
        if (gofile) return gofile[1];
        const query = /gofile\.io\/\?c=([a-zA-Z0-9]+)/i.exec(str);
        if (query) return query[1];
        return null;
    }

    function zpBuzzPythonCandidates() {
        const roots = [__dirname, process.resourcesPath].filter(Boolean);
        const bundled = roots.flatMap((root) => [
            path.join(root, 'binaries', 'win', 'python', 'python.exe'),
            path.join(root, 'script', 'python', 'python.exe')
        ]).filter((candidate, index, list) => fs.existsSync(candidate) && list.indexOf(candidate) === index);
        return [...bundled, process.env.ZONE_PLAY_PYTHON, process.env.PACKAGE_RESOLVER_PYTHON, 'python', 'py'].filter(Boolean);
    }

    function zpBuzzResolverScriptPaths() {
        const resolverRoots = [
            path.resolve(__dirname, 'script'),
            process.resourcesPath ? path.resolve(process.resourcesPath, 'script') : ''
        ].filter(Boolean);
        return resolverRoots.flatMap((root) => [
            path.join(root, 'package_link_resolver.py'),
            path.join(root, 'package_direct_resolver.py')
        ]).filter((scriptPath, index, list) => fs.existsSync(scriptPath) && list.indexOf(scriptPath) === index);
    }

    const ZP_BZZHR_SELECTOR = 'a.download-btn.gay-button';
    const ZP_BZZHR_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    function zpIsBuzzheavierUrl(url) {
        return /bzzhr\.to|buzzheavier\.com|bzzhr\.co/i.test(String(url || ''));
    }

    function zpIsBuzzheavierCookie(cookie) {
        const domain = String(cookie && cookie.domain || '').replace(/^\./, '').toLowerCase();
        return domain === 'bzzhr.to' || domain.endsWith('.bzzhr.to') || domain === 'buzzheavier.com' || domain.endsWith('.buzzheavier.com');
    }

    function zpHasUsableCookie(cookie) {
        const expires = Number(cookie && cookie.expirationDate || 0);
        return !expires || expires > Date.now() / 1000;
    }

    function zpFilterBuzzheavierCookies(cookies) {
        return (Array.isArray(cookies) ? cookies : []).filter(zpIsBuzzheavierCookie).filter(zpHasUsableCookie);
    }

    async function zpGetBuzzheavierCookies() {
        try {
            return zpFilterBuzzheavierCookies(await session.defaultSession.cookies.get({}));
        } catch (_) {
            return [];
        }
    }

    async function zpGetBuzzheavierCookieHeader() {
        const cookies = await zpGetBuzzheavierCookies();
        return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    }

    async function zpExtractBuzzheavierLandingUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (zpIsBuzzheavierUrl(value)) return value;
        if (!/steamrip\.com\/.+-free-download\/?/i.test(value)) return '';
        try {
            const body = await got(value, {
                headers: { 'user-agent': ZP_BZZHR_UA, referer: 'https://steamrip.com/' },
                timeout: { request: 20000 }
            }).text();
            const $ = cheerio.load(body);
            const candidates = [];
            $('a[href]').each((_, el) => {
                const href = String($(el).attr('href') || '').trim();
                if (!zpIsBuzzheavierUrl(href)) return;
                const text = `${$(el).text() || ''} ${$(el).parent().text() || ''}`;
                candidates.push({ href, score: /bzzhr|buzzheavier/i.test(text) ? 2 : 1 });
            });
            const picked = candidates.sort((a, b) => b.score - a.score)[0];
            if (picked && picked.href) return new URL(picked.href, value).href;
            const match = body.match(/https?:\/\/(?:[^"'<>/]+\.)?(?:bzzhr\.to|buzzheavier\.com)\/[a-zA-Z0-9]+/i);
            if (match) return match[0];
        } catch (_) {
            // SteamRIP often rejects raw HTTP fetches; the local Playwright resolver can still read the page.
        }

        const scriptPath = zpBuzzResolverScriptPaths().find((candidate) => path.basename(candidate).toLowerCase() === 'package_link_resolver.py');
        if (!scriptPath) return '';
        const runExtractor = (cmd) => new Promise((resolve) => {
            if (cmd.includes(path.sep) && !fs.existsSync(cmd)) return resolve('');
            const child = spawn(cmd, [scriptPath, value, '--print-bzzhr-only'], { windowsHide: true });
            let out = '';
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            child.on('error', () => resolve(''));
            child.on('close', () => {
                const match = /BZZHR Landing URL:\s*(\S+)/i.exec(out);
                resolve(match && zpIsBuzzheavierUrl(match[1]) ? match[1] : '');
            });
        });
        for (const cmd of zpBuzzPythonCandidates()) {
            const extracted = await runExtractor(cmd);
            if (extracted) return extracted;
        }
        return '';
    }

    function zpCreateBuzzheavierCookieWindow(url) {
        return new Promise((resolve, reject) => {
            let done = false;
            let win = null;
            let pollTimer = null;
            let timeoutTimer = null;
            let revealTimer = null;
            let revealed = false;

            const cleanup = () => {
                if (pollTimer) clearInterval(pollTimer);
                if (timeoutTimer) clearTimeout(timeoutTimer);
                if (revealTimer) clearTimeout(revealTimer);
                pollTimer = null;
                timeoutTimer = null;
                revealTimer = null;
                try {
                    if (win && !win.isDestroyed()) {
                        win.removeAllListeners('closed');
                        win.destroy();
                    }
                } catch (_) {}
                win = null;
            };

            const finish = (error, cookies = []) => {
                if (done) return;
                done = true;
                cleanup();
                if (error) reject(error);
                else resolve(cookies);
            };

            const reveal = () => {
                if (revealed || done || !win || win.isDestroyed()) return;
                revealed = true;
                try {
                    win.show();
                    win.focus();
                } catch (_) {}
            };

            try {
                win = new BrowserWindow({
                    width: 560,
                    height: 760,
                    minWidth: 420,
                    minHeight: 560,
                    show: false,
                    title: 'Resolving BZZHR',
                    autoHideMenuBar: true,
                    alwaysOnTop: true,
                    focusable: true,
                    backgroundColor: '#111111',
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        backgroundThrottling: false
                    }
                });
            } catch (error) {
                finish(error);
                return;
            }

            const webContents = win.webContents;
            win.on('closed', () => {
                if (!done) finish(new Error('BZZHR verification window closed before it finished.'));
            });
            webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            webContents.on('will-navigate', (event, nextUrl) => {
                if (!/^https?:\/\//i.test(String(nextUrl || ''))) event.preventDefault();
            });
            webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
                if (!isMainFrame || done) return;
                finish(new Error(`BZZHR verification failed (${code}): ${description} - ${validatedURL}`));
            });

            timeoutTimer = setTimeout(() => finish(new Error('Timeout waiting for BZZHR verification.')), 90000);
            revealTimer = setTimeout(reveal, 8000);
            pollTimer = setInterval(async () => {
                if (done || !win || win.isDestroyed()) return;
                try {
                    const ready = await webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(ZP_BZZHR_SELECTOR)}))`, true);
                    if (!ready) return;
                    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
                    const cookies = await zpGetBuzzheavierCookies();
                    if (cookies.length) finish(null, cookies);
                    else reveal();
                } catch (_) {
                    reveal();
                }
            }, 1000);

            webContents.loadURL(url, {
                userAgent: ZP_BZZHR_UA,
                httpReferrer: 'https://steamrip.com/'
            }).catch((error) => finish(error));
        });
    }

    async function zpEnsureBuzzheavierCookies(rawUrl, forceWindow = false) {
        let cookies = await zpGetBuzzheavierCookies();
        if (cookies.length && !forceWindow) return cookies;
        const landingUrl = await zpExtractBuzzheavierLandingUrl(rawUrl);
        if (!zpIsBuzzheavierUrl(landingUrl)) return cookies;
        try {
            cookies = await zpCreateBuzzheavierCookieWindow(landingUrl);
        } catch (_) {
            cookies = await zpGetBuzzheavierCookies();
        }
        return zpFilterBuzzheavierCookies(cookies);
    }

    async function zpResolveBuzzheavier(rawUrl) {
        const isSteamRipPage = /steamrip\.com\/.+-free-download\/?/i.test(String(rawUrl || ''));
        if (!isSteamRipPage) try {
            const body = await got(rawUrl, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    referer: 'https://steamrip.com/'
                },
                timeout: { request: 12000 }
            }).text();
            const matches = [...body.matchAll(/hx-get=["']([^"']*download[^"']*)["']/gi)];
            if (matches.length) {
                const parsed = new URL(rawUrl);
                const href = matches[0][1];
                const candidate = href.startsWith('http') ? href : `${parsed.protocol}//${parsed.host}${href.startsWith('/') ? '' : '/'}${href}`;
                if (/^https?:\/\/ts\./i.test(candidate)) return candidate;
            }
        } catch (_) {}

        const scriptPaths = zpBuzzResolverScriptPaths();
        if (!scriptPaths.length) return rawUrl;

        const runPython = (cmd, scriptPath, cookies = []) => new Promise((resolve) => {
            if (cmd.includes(path.sep) && !fs.existsSync(cmd)) return resolve(null);
            const args = [scriptPath, rawUrl];
            if (cookies.length) args.push(JSON.stringify(cookies));
            const child = spawn(cmd, args, { windowsHide: true });
            let out = '';
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(killTimer);
                resolve(value);
            };
            const killTimer = setTimeout(() => {
                try { child.kill('SIGTERM'); } catch (_) {}
                setTimeout(() => {
                    try {
                        if (!child.killed) child.kill('SIGKILL');
                    } catch (_) {}
                }, 1200);
                finish(null);
            }, 120000);
            child.stdout.on('data', (d) => { out += d.toString(); });
            child.stderr.on('data', (d) => { out += d.toString(); });
            child.on('error', () => finish(null));
            child.on('close', () => {
                const match = /Direct Stream URL:\s*(\S+)/i.exec(out);
                const resolved = match ? match[1] : '';
                finish(/^https?:\/\/ts\.(?:bzzhr\.to|buzzheavier\.com)\//i.test(resolved) ? resolved : null);
            });
        });

        let cookies = await zpGetBuzzheavierCookies();
        if (cookies.length) {
            for (const scriptPath of scriptPaths) {
                for (const cmd of zpBuzzPythonCandidates()) {
                    const resolved = await runPython(cmd, scriptPath, cookies);
                    if (resolved) return resolved;
                }
            }
        }

        cookies = await zpEnsureBuzzheavierCookies(rawUrl, true);
        if (cookies.length) {
            for (const scriptPath of scriptPaths) {
                for (const cmd of zpBuzzPythonCandidates()) {
                    const resolved = await runPython(cmd, scriptPath, cookies);
                    if (resolved) return resolved;
                }
            }
        }

        return rawUrl;
    }

    async function zpResolveDownloadUrl(rawUrl, game = null) {
        const gofileId = zpParseGofileId(rawUrl);
        if (gofileId) return `https://gofilecdn.eu.cc/${gofileId}`;
        if (/steamrip\.com\/.+-free-download\/?/i.test(String(rawUrl || ''))) return await zpResolveBuzzheavier(rawUrl);
        if (/bzzhr\.to|buzzheavier\.com/i.test(String(rawUrl || ''))) return await zpResolveBuzzheavier(rawUrl);
        return rawUrl;
    }

    async function zpProbeDownload(url, title, extraHeaders = {}) {
        const fallback = `${zpSafeName(title || 'ZonePlay Package')}.zip`;
        try {
            const res = await got(url, {
                method: 'GET',
                headers: { range: 'bytes=0-0', 'user-agent': ZP_BZZHR_UA, ...extraHeaders },
                followRedirect: true,
                throwHttpErrors: false,
                timeout: { request: 20000 }
            });
            const contentType = String(res.headers['content-type'] || '');
            if (res.statusCode >= 400) throw new Error(`Response code ${res.statusCode}`);
            if (/text\/html/i.test(contentType) && /bzzhr\.to|buzzheavier\.com|steamrip\.com/i.test(String(res.url || url))) {
                throw new Error('Resolved URL returned a web page instead of a package.');
            }
            const range = res.headers['content-range'];
            const total = range && /\/(\d+)$/.exec(range) ? Number(/\/(\d+)$/.exec(range)[1]) : Number(res.headers['content-length'] || 0);
            return {
                url: res.url || url,
                fileName: zpGetHeaderFileName(res.headers, fallback),
                total: Number.isFinite(total) ? total : 0
            };
        } catch (err) {
            const wrapped = new Error(err && err.message ? err.message : 'Could not inspect download URL.');
            wrapped.url = url;
            wrapped.fileName = fallback;
            throw wrapped;
        }
    }

    function zpFormatEta(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '--';
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        if (mins < 60) return `${mins}m ${secs}s`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    }

    function zpFormatBytes(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = value;
        let index = 0;
        while (size >= 1024 && index < units.length - 1) {
            size /= 1024;
            index += 1;
        }
        return `${size >= 10 || index === 0 ? size.toFixed(1) : size.toFixed(2)} ${units[index]}`;
    }

    function zpGetFreeSpace(folder) {
        try {
            const stats = fs.statfsSync(folder);
            return Number(stats.bavail || stats.bfree || 0) * Number(stats.bsize || 0);
        } catch (_) {
            return 0;
        }
    }

    function zpStorageCheck(folder, packageBytes, willExtract) {
        const packageSize = Number(packageBytes || 0);
        if (!Number.isFinite(packageSize) || packageSize <= 0) {
            return { ok: true, checked: false };
        }
        const freeBytes = zpGetFreeSpace(folder);
        if (!freeBytes) return { ok: true, checked: false };
        const requiredBytes = packageSize * (willExtract ? 2 : 1);
        return {
            ok: freeBytes >= requiredBytes,
            checked: true,
            freeBytes,
            requiredBytes,
            packageBytes: packageSize,
            extractBytes: willExtract ? packageSize : 0,
            freeText: zpFormatBytes(freeBytes),
            requiredText: zpFormatBytes(requiredBytes),
            packageText: zpFormatBytes(packageSize),
            extractText: willExtract ? zpFormatBytes(packageSize) : '0 B',
            folder
        };
    }

    function zpSendProgress(sender, task, extra = {}) {
        const transferred = task.transferred || 0;
        const total = task.total || 0;
        const elapsed = Math.max(0.001, (Date.now() - task.startedAt) / 1000);
        const speed = transferred / elapsed;
        const eta = total > 0 && speed > 0 ? (total - transferred) / speed : NaN;
        sender.send('zp-download-progress', {
            taskId: task.id,
            phase: task.phase,
            transferred,
            total,
            percent: total > 0 ? transferred / total : 0,
            speed,
            etaText: zpFormatEta(eta),
            ...extra
        });
    }

    function zpFolderSize(dir) {
        let total = 0;
        function walk(currentDir, depth) {
            if (depth > 12) return;
            let entries;
            try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch (_) { return; }
            for (const entry of entries) {
                const full = path.join(currentDir, entry.name);
                try {
                    if (entry.isDirectory()) walk(full, depth + 1);
                    else if (entry.isFile()) total += fs.statSync(full).size;
                } catch (_) {}
            }
        }
        walk(dir, 0);
        return total;
    }

    function zpScanExeFiles(rootDir) {
        const results = [];
        const bad = /(unins|uninstall|crash|unitycrashhandler|setup|install|redist|vcredist|dxsetup|dotnet|helper|service|eac|easyanticheat|benchmark)/i;
        function walk(dir, depth) {
            if (depth > 8 || results.length > 500) return;
            let entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (/^(_commonredist|redist|support|extras|docs|manual)$/i.test(entry.name)) continue;
                    walk(full, depth + 1);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
                    const rel = path.relative(rootDir, full);
                    let score = rel.split(path.sep).length === 1 ? 80 : 30 - depth;
                    if (/binaries\\win64|binaries\/win64|shipping/i.test(rel)) score += 120;
                    if (/win64|x64/i.test(rel)) score += 15;
                    if (bad.test(rel)) score -= 140;
                    results.push({ path: full, relativePath: rel, name: entry.name, score });
                }
            }
        }
        walk(rootDir, 0);
        return results.sort((a, b) => b.score - a.score);
    }

    function zpAssertInside(baseDir, targetPath) {
        const base = path.resolve(baseDir);
        const target = path.resolve(targetPath);
        if (target !== base && !target.startsWith(base + path.sep)) {
            throw new Error('Archive entry tried to write outside the selected folder.');
        }
    }

    function zpIsStopped(task) {
        return task && task.status === 'stopped';
    }

    function zpStoppedError() {
        const error = new Error('Download stopped.');
        error.code = 'ZONE_PLAY_STOPPED';
        return error;
    }

    async function zpExtractZipWithProgress(zipPath, targetDir, sender, task) {
        await fsPromises.mkdir(targetDir, { recursive: true });
        return new Promise((resolve, reject) => {
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err) { reject(err); return; }
                task.phase = 'extracting';
                task.total = Math.max(1, zipfile.entries.reduce ? 1 : 1);
                let total = 0;
                let done = 0;
                const entries = [];
                task.extractCancel = () => {
                    try { zipfile.close(); } catch (_) {}
                    reject(zpStoppedError());
                };

                zipfile.readEntry();
                zipfile.on('entry', (entry) => {
                    if (zpIsStopped(task)) {
                        try { zipfile.close(); } catch (_) {}
                        reject(zpStoppedError());
                        return;
                    }
                    entries.push(entry);
                    total += Number(entry.uncompressedSize || 0);
                    zipfile.readEntry();
                });
                zipfile.on('end', () => {
                    task.total = Math.max(1, total);
                    task.transferred = 0;
                    yauzl.open(zipPath, { lazyEntries: true }, (openErr, unzip) => {
                        if (openErr) { reject(openErr); return; }
                        task.extractCancel = () => {
                            try { unzip.close(); } catch (_) {}
                            reject(zpStoppedError());
                        };
                        unzip.readEntry();
                        unzip.on('entry', async (entry) => {
                            try {
                                if (zpIsStopped(task)) {
                                    try { unzip.close(); } catch (_) {}
                                    reject(zpStoppedError());
                                    return;
                                }
                                const dest = path.join(targetDir, entry.fileName);
                                zpAssertInside(targetDir, dest);
                                if (/\/$/.test(entry.fileName)) {
                                    await fsPromises.mkdir(dest, { recursive: true });
                                    unzip.readEntry();
                                    return;
                                }
                                await fsPromises.mkdir(path.dirname(dest), { recursive: true });
                                unzip.openReadStream(entry, (streamErr, readStream) => {
                                    if (streamErr) { reject(streamErr); return; }
                                    task.extractStream = readStream;
                                    readStream.on('data', (chunk) => {
                                        if (zpIsStopped(task)) return;
                                        done += chunk.length;
                                        task.transferred = done;
                                        zpSendProgress(sender, task);
                                    });
                                    readStream.pipe(fs.createWriteStream(dest))
                                        .on('finish', () => unzip.readEntry())
                                        .on('error', reject);
                                });
                            } catch (entryErr) {
                                reject(entryErr);
                            }
                        });
                        unzip.on('end', resolve);
                        unzip.on('error', reject);
                    });
                });
                zipfile.on('error', reject);
            });
        }).finally(() => {
            task.extractCancel = null;
            task.extractStream = null;
        });
    }

    function zpArchiveKind(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.zip') return 'zip';
        if (ext === '.rar') return 'rar';
        if (ext === '.7z') return '7z';
        return '';
    }

    function zpArchiveExtForKind(kind, fallbackExt = '') {
        if (kind === 'zip') return '.zip';
        if (kind === 'rar') return '.rar';
        if (kind === '7z') return '.7z';
        return fallbackExt || '';
    }

    function zpTitleArchiveName(title, originalFileName) {
        const originalExt = path.extname(originalFileName || '').toLowerCase();
        const kind = zpArchiveKind(originalFileName || '');
        const ext = zpArchiveExtForKind(kind, originalExt || '.zip');
        return `${zpSafeName(title || path.basename(originalFileName || 'ZonePlay', originalExt), 'ZonePlay')}${ext}`;
    }

    async function zpPrepareCacheDir(folder) {
        const cacheDir = path.join(folder, '.zone-cache');
        await fsPromises.mkdir(cacheDir, { recursive: true });
        if (process.platform === 'win32') {
            try { await runPowerShell(`attrib +h ${psQuote(cacheDir)}`); } catch (_) {}
        }
        await zpSweepTempDownloads(cacheDir);
        return cacheDir;
    }

    function zpExternalExtractorCandidates(kind) {
        const root = process.env.SystemRoot || 'C:\\Windows';
        const candidates = [
            {
                name: 'tar',
                exe: path.join(root, 'System32', 'tar.exe'),
                args: (archive, dest) => ['-xf', archive, '-C', dest]
            },
            {
                name: '7z',
                exe: path.join(__dirname, 'tools', '7za.exe'),
                args: (archive, dest) => ['x', archive, `-o${dest}`, '-y']
            },
            {
                name: '7z',
                exe: path.join(__dirname, 'tools', '7z.exe'),
                args: (archive, dest) => ['x', archive, `-o${dest}`, '-y']
            },
            {
                name: '7z',
                exe: 'C:\\Program Files\\7-Zip\\7z.exe',
                args: (archive, dest) => ['x', archive, `-o${dest}`, '-y']
            },
            {
                name: '7z',
                exe: 'C:\\Program Files (x86)\\7-Zip\\7z.exe',
                args: (archive, dest) => ['x', archive, `-o${dest}`, '-y']
            },
            {
                name: 'UnRAR',
                exe: 'C:\\Program Files\\WinRAR\\UnRAR.exe',
                args: (archive, dest) => ['x', '-y', archive, dest.endsWith(path.sep) ? dest : dest + path.sep]
            },
            {
                name: 'WinRAR',
                exe: 'C:\\Program Files\\WinRAR\\WinRAR.exe',
                args: (archive, dest) => ['x', '-ibck', '-y', archive, dest.endsWith(path.sep) ? dest : dest + path.sep]
            }
        ];
        if (kind === '7z') return candidates.filter((c) => c.name !== 'tar');
        return candidates;
    }

    function zpParseTarListSize(output) {
        let total = 0;
        const monthRe = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
        for (const line of String(output || '').split(/\r?\n/)) {
            if (!line.trim() || /^d/.test(line.trim())) continue;
            let match = new RegExp(`\\s(\\d+)\\s+${monthRe}\\s+\\d{1,2}\\s+`, 'i').exec(line);
            if (!match) match = /\s(\d+)\s+\d{4}-\d{2}-\d{2}\s+/.exec(line);
            if (match) total += Number(match[1]) || 0;
        }
        return total;
    }

    function zpParse7zListSize(output) {
        let total = 0;
        for (const line of String(output || '').split(/\r?\n/)) {
            const match = /^Size = (\d+)/i.exec(line.trim());
            if (match) total += Number(match[1]) || 0;
        }
        return total;
    }

    async function zpGetArchiveUnpackedSize(archivePath, candidates) {
        for (const extractor of candidates) {
            try {
                const output = await new Promise((resolve, reject) => {
                    const isTar = extractor.name === 'tar';
                    const args = isTar ? ['-tvf', archivePath] : ['l', '-slt', archivePath];
                    execFile(extractor.exe, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 64 }, (error, stdout, stderr) => {
                        if (error) { reject(error); return; }
                        resolve(stdout || stderr || '');
                    });
                });
                const total = extractor.name === 'tar' ? zpParseTarListSize(output) : zpParse7zListSize(output);
                if (total > 0) return total;
            } catch (_) {}
        }
        return 0;
    }

    async function zpExtractExternalArchive(archivePath, targetDir, sender, task, kind) {
        await fsPromises.mkdir(targetDir, { recursive: true });
        task.phase = 'extracting';
        const candidates = zpExternalExtractorCandidates(kind).filter((c) => fs.existsSync(c.exe));
        if (!candidates.length) {
            throw new Error(`${kind.toUpperCase()} extraction needs tar, 7-Zip, WinRAR, or UnRAR installed.`);
        }

        const baseSize = zpFolderSize(targetDir);
        const unpackedSize = await zpGetArchiveUnpackedSize(archivePath, candidates);
        task.total = unpackedSize;
        task.transferred = 0;
        zpSendProgress(sender, task, { indeterminate: unpackedSize <= 0, message: `Extracting ${kind.toUpperCase()} archive...` });

        let lastError = null;
        for (const extractor of candidates) {
            try {
                await new Promise((resolve, reject) => {
                    const tick = setInterval(() => {
                        if (zpIsStopped(task)) return;
                        const extracted = Math.max(0, zpFolderSize(targetDir) - baseSize);
                        task.transferred = task.total > 0 ? Math.min(extracted, task.total) : extracted;
                        zpSendProgress(sender, task, { indeterminate: task.total <= 0, extractor: extractor.name });
                    }, 1000);
                    const child = execFile(extractor.exe, extractor.args(archivePath, targetDir), { windowsHide: true, maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
                        clearInterval(tick);
                        task.extractProcess = null;
                        task.extractCancel = null;
                        if (zpIsStopped(task)) {
                            reject(zpStoppedError());
                            return;
                        }
                        if (error) {
                            error.message = stderr || stdout || error.message;
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                    task.extractProcess = child;
                    task.extractCancel = () => {
                        clearInterval(tick);
                        try { child.kill('SIGTERM'); } catch (_) {}
                        setTimeout(() => {
                            try {
                                if (!child.killed) child.kill('SIGKILL');
                            } catch (_) {}
                        }, 800);
                    };
                });
                const extracted = Math.max(0, zpFolderSize(targetDir) - baseSize);
                task.transferred = task.total > 0 ? task.total : extracted;
                if (!zpIsStopped(task)) zpSendProgress(sender, task, { indeterminate: task.total <= 0, extractor: extractor.name });
                return extractor.name;
            } catch (err) {
                if (zpIsStopped(task) || err.code === 'ZONE_PLAY_STOPPED') throw zpStoppedError();
                lastError = err;
            }
        }
        throw new Error(lastError && lastError.message ? lastError.message : `Could not extract ${kind.toUpperCase()} archive.`);
    }

    async function zpExtractArchive(packagePath, extractDir, sender, task) {
        const kind = zpArchiveKind(packagePath);
        if (kind === 'zip') {
            await zpExtractZipWithProgress(packagePath, extractDir, sender, task);
            return 'zip';
        }
        if (kind === 'rar' || kind === '7z') {
            return await zpExtractExternalArchive(packagePath, extractDir, sender, task, kind);
        }
        return '';
    }

    async function zpCreateDesktopShortcut(title, exePath) {
        if (!exePath || !fs.existsSync(exePath)) throw new Error('Selected executable was not found.');
        const shortcutPath = path.join(DESKTOP_PATH_INTERNAL, `${sanitizeShortcutName(title || path.basename(exePath, '.exe'))}.lnk`);
        await createDesktopShortcut(shortcutPath, exePath, path.dirname(exePath), `GameZoneQA Zone Play shortcut for ${title || path.basename(exePath)}`);
        return shortcutPath;
    }

    async function zpRemoveDesktopShortcutsForInstall(install) {
        const targets = new Set();
        if (install && install.desktopShortcut && install.desktopShortcut.path) targets.add(install.desktopShortcut.path);
        if (install && install.title) targets.add(path.join(DESKTOP_PATH_INTERNAL, `${sanitizeShortcutName(install.title)}.lnk`));
        let removed = 0;
        for (const shortcutPath of targets) {
            try {
                if (shortcutPath && fs.existsSync(shortcutPath)) {
                    await fsPromises.rm(shortcutPath, { force: true });
                    removed += 1;
                }
            } catch (_) {}
        }
        return removed;
    }

    function zpArtworkExt(url, contentType) {
        const ext = path.extname((String(url || '').split('?')[0] || '')).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
        if (/png/i.test(String(contentType || ''))) return '.png';
        return '.jpg';
    }

    async function zpDownloadArtwork(url) {
        if (!url) return null;
        const response = await got(url, {
            responseType: 'buffer',
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: { request: 20000 },
            throwHttpErrors: false
        });
        if (!response || response.statusCode >= 400 || !response.body || !response.body.length) return null;
        return {
            buffer: response.body,
            ext: zpArtworkExt(url, response.headers && response.headers['content-type'])
        };
    }

    async function zpWriteSteamArtwork(configDir, ids, artwork) {
        const gridDir = path.join(configDir, 'grid');
        await fsPromises.mkdir(gridDir, { recursive: true });
        let written = 0;
        const header = await zpDownloadArtwork(artwork && artwork.imageUrl);
        const hero = await zpDownloadArtwork((artwork && artwork.heroUrl) || (artwork && artwork.imageUrl));
        const idList = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));

        for (const id of idList) {
            if (header) {
                await fsPromises.writeFile(path.join(gridDir, `${id}${header.ext}`), header.buffer);
                await fsPromises.writeFile(path.join(gridDir, `${id}p${header.ext}`), header.buffer);
                written += 2;
            }
            if (hero) {
                await fsPromises.writeFile(path.join(gridDir, `${id}_hero${hero.ext}`), hero.buffer);
                written += 1;
            }
        }
        return written;
    }

    async function zpRemoveSteamArtwork(configDir, ids) {
        const gridDir = path.join(configDir, 'grid');
        if (!fs.existsSync(gridDir)) return 0;
        let removed = 0;
        const idList = Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean)));
        for (const id of idList) {
            for (const name of [`${id}.jpg`, `${id}.png`, `${id}p.jpg`, `${id}p.png`, `${id}_hero.jpg`, `${id}_hero.png`]) {
                const full = path.join(gridDir, name);
                try {
                    if (fs.existsSync(full)) {
                        await fsPromises.rm(full, { force: true });
                        removed += 1;
                    }
                } catch (_) {}
            }
        }
        return removed;
    }

    async function zpRemoveSteamShortcutsForInstall(install) {
        if (!install) return 0;
        if (!detectedSteamPath) {
            try { detectedSteamPath = await findSteamPath(); } catch (_) {}
        }
        const configs = new Set();
        const known = install.steamShortcut ? [install.steamShortcut] : [];
        if (Array.isArray(install.steamShortcuts)) known.push(...install.steamShortcuts);
        for (const meta of known) {
            if (meta && meta.configDir) configs.add(meta.configDir);
            if (meta && meta.shortcutsPath) configs.add(path.dirname(meta.shortcutsPath));
        }
        if (detectedSteamPath) {
            const userdataDir = path.join(detectedSteamPath, 'userdata');
            try {
                for (const dirent of fs.readdirSync(userdataDir, { withFileTypes: true })) {
                    if (dirent.isDirectory() && /^\d+$/.test(dirent.name)) configs.add(path.join(userdataDir, dirent.name, 'config'));
                }
            } catch (_) {}
        }

        const appNames = new Set([String(install.title || '')].filter(Boolean));
        for (const meta of known) if (meta && meta.appName) appNames.add(String(meta.appName));
        const exePaths = new Set();
        if (install.primaryExe) exePaths.add(path.resolve(install.primaryExe));
        if (Array.isArray(install.exeFiles)) {
            for (const exe of install.exeFiles) if (exe && exe.path) exePaths.add(path.resolve(exe.path));
        }
        for (const meta of known) if (meta && meta.exePath) exePaths.add(path.resolve(meta.exePath));
        const steamIds = new Set();
        for (const meta of known) {
            if (!meta) continue;
            if (meta.signedId != null) steamIds.add(String(meta.signedId));
            if (meta.unsignedId != null) steamIds.add(String(meta.unsignedId));
            if (Array.isArray(meta.ids)) meta.ids.forEach((id) => steamIds.add(String(id)));
        }

        let removed = 0;
        for (const configDir of configs) {
            const shortcutsPath = path.join(configDir, 'shortcuts.vdf');
            if (!fs.existsSync(shortcutsPath)) continue;
            let shortcuts = {};
            try { shortcuts = zpReadShortcutsVdf(shortcutsPath); } catch (_) { continue; }
            let changed = false;
            for (const key of Object.keys(shortcuts)) {
                const item = shortcuts[key] && shortcuts[key].value;
                if (!item) continue;
                const appName = item.AppName && item.AppName.value || '';
                const exeRaw = item.Exe && item.Exe.value || '';
                const exeClean = exeRaw.replace(/^"|"$/g, '');
                const appid = item.appid && item.appid.value;
                const idMatch = appid != null && steamIds.has(String(appid));
                const nameExeMatch = appNames.has(appName) && (!exeClean || exePaths.has(path.resolve(exeClean)));
                const legacyNameMatch = appNames.has(appName) && exePaths.size === 0;
                if (idMatch || nameExeMatch || legacyNameMatch) {
                    delete shortcuts[key];
                    changed = true;
                    removed += 1;
                }
            }
            if (changed) {
                try { await fsPromises.copyFile(shortcutsPath, `${shortcutsPath}.gamezoneqa-delete-${Date.now()}.bak`); } catch (_) {}
                zpWriteShortcutsVdf(shortcutsPath, shortcuts);
                await zpRemoveSteamArtwork(configDir, Array.from(steamIds));
            }
        }
        return removed;
    }

    function zpLaunchGameExe(exePath) {
        if (!exePath || !fs.existsSync(exePath)) throw new Error('Selected executable was not found.');
        const child = spawn(exePath, [], { detached: true, cwd: path.dirname(exePath), stdio: 'ignore' });
        child.unref();
    }

    function zpIsSafeDeleteDir(dir) {
        if (!dir) return false;
        const resolved = path.resolve(dir);
        const parsed = path.parse(resolved);
        if (resolved === parsed.root) return false;
        if (resolved.length < parsed.root.length + 6) return false;
        const base = path.basename(resolved);
        if (!base || base === '.' || base === '..') return false;
        return true;
    }

    function zpInferInstallRootFromExe(exe) {
        if (!exe || !exe.path || !exe.relativePath) return '';
        const absoluteExe = path.resolve(exe.path);
        const relativeParts = String(exe.relativePath).split(/[\\/]+/).filter(Boolean);
        if (!relativeParts.length) return '';
        let root = absoluteExe;
        for (let i = 0; i < relativeParts.length; i++) root = path.dirname(root);
        return root;
    }

    function zpCollectInstallDeleteTargets(install) {
        const dirs = new Set();
        const files = new Set();
        if (!install || typeof install !== 'object') return { dirs: [], files: [] };

        if (install.installDir) dirs.add(path.resolve(install.installDir));
        if (install.packagePath) files.add(path.resolve(install.packagePath));

        if (Array.isArray(install.exeFiles)) {
            for (const exe of install.exeFiles) {
                const inferred = zpInferInstallRootFromExe(exe);
                if (inferred) dirs.add(path.resolve(inferred));
            }
        }

        if (!dirs.size && install.primaryExe) {
            const primaryExe = path.resolve(install.primaryExe);
            const exeRecord = Array.isArray(install.exeFiles)
                ? install.exeFiles.find((exe) => exe && path.resolve(exe.path || '') === primaryExe)
                : null;
            const inferred = zpInferInstallRootFromExe(exeRecord);
            if (inferred) dirs.add(path.resolve(inferred));
        }

        const safeDirs = Array.from(dirs).filter((dir) => zpIsSafeDeleteDir(dir));
        const prunedDirs = safeDirs.filter((dir, index, list) => {
            return !list.some((other, otherIndex) => otherIndex !== index && dir.startsWith(other + path.sep));
        });
        return {
            dirs: prunedDirs,
            files: Array.from(files)
        };
    }

    async function zpDeleteInstallFiles(install) {
        const targets = zpCollectInstallDeleteTargets(install);
        const deleted = [];
        for (const dir of targets.dirs) {
            if (!fs.existsSync(dir)) continue;
            await fsPromises.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
            deleted.push(dir);
        }
        for (const filePath of targets.files) {
            try {
                if (filePath && fs.existsSync(filePath)) {
                    await fsPromises.rm(filePath, { force: true, maxRetries: 3, retryDelay: 250 });
                    deleted.push(filePath);
                }
            } catch (_) {}
        }
        return deleted;
    }

    function zpCrc32(str) {
        const table = zpCrc32.table || (zpCrc32.table = Array.from({ length: 256 }, (_, n) => {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            return c >>> 0;
        }));
        let crc = 0xffffffff;
        const buf = Buffer.from(String(str), 'utf8');
        for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    }

    function zpReadCString(buf, offsetRef) {
        let end = offsetRef.offset;
        while (end < buf.length && buf[end] !== 0) end++;
        const out = buf.slice(offsetRef.offset, end).toString('utf8');
        offsetRef.offset = end + 1;
        return out;
    }

    function zpParseBinaryVdfObject(buf, offsetRef) {
        const obj = {};
        while (offsetRef.offset < buf.length) {
            const type = buf[offsetRef.offset++];
            if (type === 0x08) break;
            const key = zpReadCString(buf, offsetRef);
            if (type === 0x00) obj[key] = { kind: 'object', value: zpParseBinaryVdfObject(buf, offsetRef) };
            else if (type === 0x01) obj[key] = { kind: 'string', value: zpReadCString(buf, offsetRef) };
            else if (type === 0x02) { obj[key] = { kind: 'int', value: buf.readInt32LE(offsetRef.offset) }; offsetRef.offset += 4; }
            else if (type === 0x07) { obj[key] = { kind: 'uint64', value: buf.readBigUInt64LE(offsetRef.offset) }; offsetRef.offset += 8; }
            else break;
        }
        return obj;
    }

    function zpReadShortcutsVdf(filePath) {
        if (!fs.existsSync(filePath)) return {};
        const buf = fs.readFileSync(filePath);
        const root = zpParseBinaryVdfObject(buf, { offset: 0 });
        return root.shortcuts && root.shortcuts.kind === 'object' ? root.shortcuts.value : {};
    }

    function zpCstr(value) {
        return Buffer.concat([Buffer.from(String(value), 'utf8'), Buffer.from([0])]);
    }

    function zpWriteBinaryVdfObject(obj) {
        const parts = [];
        for (const key of Object.keys(obj)) {
            const node = obj[key];
            if (!node) continue;
            if (node.kind === 'object') parts.push(Buffer.from([0x00]), zpCstr(key), zpWriteBinaryVdfObject(node.value || {}));
            else if (node.kind === 'string') parts.push(Buffer.from([0x01]), zpCstr(key), zpCstr(node.value || ''));
            else if (node.kind === 'int') {
                const b = Buffer.alloc(4);
                b.writeInt32LE(Number(node.value || 0), 0);
                parts.push(Buffer.from([0x02]), zpCstr(key), b);
            } else if (node.kind === 'uint64') {
                const b = Buffer.alloc(8);
                b.writeBigUInt64LE(BigInt(node.value || 0), 0);
                parts.push(Buffer.from([0x07]), zpCstr(key), b);
            }
        }
        parts.push(Buffer.from([0x08]));
        return Buffer.concat(parts);
    }

    function zpWriteShortcutsVdf(filePath, shortcuts) {
        const root = { shortcuts: { kind: 'object', value: shortcuts } };
        fs.writeFileSync(filePath, zpWriteBinaryVdfObject(root));
    }

    async function zpAddToSteamOffline(title, exePath, artwork = {}) {
        if (!exePath || !fs.existsSync(exePath)) throw new Error('Selected executable was not found.');
        if (!detectedSteamPath) detectedSteamPath = await findSteamPath();
        if (!detectedSteamPath) throw new Error('Steam folder was not found.');
        const userdataDir = path.join(detectedSteamPath, 'userdata');
        if (!fs.existsSync(userdataDir)) throw new Error('Steam userdata folder was not found.');

        const userDirs = fs.readdirSync(userdataDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
            .map((d) => path.join(userdataDir, d.name, 'config'));
        if (!userDirs.length) throw new Error('No Steam user config folder was found.');
        userDirs.sort((a, b) => {
            const af = path.join(a, 'shortcuts.vdf');
            const bf = path.join(b, 'shortcuts.vdf');
            const am = fs.existsSync(af) ? fs.statSync(af).mtimeMs : 0;
            const bm = fs.existsSync(bf) ? fs.statSync(bf).mtimeMs : 0;
            return bm - am;
        });

        const configDir = userDirs[0];
        await fsPromises.mkdir(configDir, { recursive: true });
        const shortcutsPath = path.join(configDir, 'shortcuts.vdf');
        if (fs.existsSync(shortcutsPath)) {
            const backup = `${shortcutsPath}.gamezoneqa-${Date.now()}.bak`;
            await fsPromises.copyFile(shortcutsPath, backup);
        }

        let shortcuts = {};
        try { shortcuts = zpReadShortcutsVdf(shortcutsPath); } catch (_) { shortcuts = {}; }
        const appName = String(title || path.basename(exePath, '.exe'));
        const exeQuoted = `"${exePath}"`;
        const startDirQuoted = `"${path.dirname(exePath)}"`;
        const unsignedId = (zpCrc32(exeQuoted + appName) | 0x80000000) >>> 0;
        const signedId = unsignedId > 0x7fffffff ? unsignedId - 0x100000000 : unsignedId;
        const existingKey = Object.keys(shortcuts).find((key) => {
            const item = shortcuts[key] && shortcuts[key].value;
            return item && item.Exe && item.Exe.value === exeQuoted && item.AppName && item.AppName.value === appName;
        });
        const nextKey = existingKey || String(Math.max(-1, ...Object.keys(shortcuts).map((k) => /^\d+$/.test(k) ? Number(k) : -1)) + 1);
        shortcuts[nextKey] = {
            kind: 'object',
            value: {
                appid: { kind: 'int', value: signedId },
                AppName: { kind: 'string', value: appName },
                Exe: { kind: 'string', value: exeQuoted },
                StartDir: { kind: 'string', value: startDirQuoted },
                icon: { kind: 'string', value: exePath },
                ShortcutPath: { kind: 'string', value: '' },
                LaunchOptions: { kind: 'string', value: '' },
                IsHidden: { kind: 'int', value: 0 },
                AllowDesktopConfig: { kind: 'int', value: 1 },
                AllowOverlay: { kind: 'int', value: 1 },
                OpenVR: { kind: 'int', value: 0 },
                Devkit: { kind: 'int', value: 0 },
                DevkitGameID: { kind: 'string', value: '' },
                LastPlayTime: { kind: 'int', value: 0 },
                FlatpakAppID: { kind: 'string', value: '' },
                tags: { kind: 'object', value: { 0: { kind: 'string', value: 'Zone Play' } } }
            }
        };
        zpWriteShortcutsVdf(shortcutsPath, shortcuts);
        const artworkCount = await zpWriteSteamArtwork(configDir, [signedId, unsignedId], artwork);
        return { shortcutsPath, configDir, shortcutKey: nextKey, signedId, unsignedId, appName, exePath, artworkCount };
    }

    ipcMain.handle('zp-fetch-games', async () => {
        if (!isUserPremium) return { success: false, games: [], installs: {}, message: 'Premium feature only.' };
        try {
            const games = await robustFetchJson(ZONE_PLAY_GAMES_URL_INTERNAL);
            const installs = await zpReadInstalls();
            return { success: true, games: Array.isArray(games) ? games : [], installs };
        } catch (e) {
            return { success: false, games: [], installs: {}, message: e.message };
        }
    });

    ipcMain.handle('zp-select-download-folder', async () => {
        if (!isUserPremium) return null;
        const res = await dialog.showOpenDialog(mainWindow, { title: 'Select Zone Play Save Location', properties: ['openDirectory', 'createDirectory'] });
        return res.canceled ? null : res.filePaths[0];
    });

    ipcMain.handle('zp-start-download', async (event, { game, folder }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        if (!game || !game.download_url) return { success: false, message: 'Missing download URL.' };
        if (!folder) return { success: false, message: 'Select a save location first.' };
        await fsPromises.mkdir(folder, { recursive: true });

        const taskId = crypto.randomUUID();
        const sender = event.sender;
        const title = String(game.title || 'Zone Play Game');
        sender.send('zp-download-status', { taskId, status: 'resolving', message: `Resolving download link for ${title}...` });
        let resolvedUrl;
        let probe;
        let downloadHeaders = {};
        try {
            resolvedUrl = await zpResolveDownloadUrl(game.download_url, game);
            const isBuzzheavierSource = /steamrip\.com|bzzhr\.to|buzzheavier\.com/i.test(String(game.download_url || '')) || /bzzhr\.to|buzzheavier\.com/i.test(String(resolvedUrl || ''));
            if (isBuzzheavierSource) {
                const cookieHeader = await zpGetBuzzheavierCookieHeader();
                downloadHeaders = {
                    referer: zpIsBuzzheavierUrl(game.download_url) ? game.download_url : 'https://steamrip.com/',
                    ...(cookieHeader ? { cookie: cookieHeader } : {})
                };
            }
            probe = await zpProbeDownload(resolvedUrl, title, downloadHeaders);
        } catch (e) {
            const isSteamRipSource = /steamrip\.com|bzzhr\.to|buzzheavier\.com/i.test(String(game.download_url || ''));
            const message = isSteamRipSource
                ? 'BZZHR resolver did not return a direct package link yet. Try again later or use a GoFile source.'
                : (e && e.message ? e.message : 'Could not resolve download link.');
            sender.send('zp-download-status', { taskId, status: 'error', message });
            return { success: false, taskId, message };
        }
        const fileName = zpTitleArchiveName(title, probe.fileName || `${title}.zip`);
        const archiveKindFromName = zpArchiveKind(fileName);
        const extractDir = path.join(folder, path.basename(fileName, path.extname(fileName)));
        const storage = zpStorageCheck(folder, probe.total || 0, !!archiveKindFromName);
        if (storage.checked && !storage.ok) {
            const message = `Not enough storage for ${title}.`;
            sender.send('zp-download-status', {
                taskId,
                status: 'storage-error',
                message,
                storage
            });
            return { success: false, taskId, message, storage };
        }
        let packagePath = path.join(folder, fileName);
        let archiveDownloadedToTemp = false;
        let taskCacheDir = '';
        if (archiveKindFromName) {
            const cacheDir = await zpPrepareCacheDir(folder);
            taskCacheDir = path.join(cacheDir, taskId);
            await fsPromises.mkdir(taskCacheDir, { recursive: true });
            packagePath = path.join(taskCacheDir, fileName);
            archiveDownloadedToTemp = true;
        }
        const task = {
            id: taskId,
            title,
            phase: 'downloading',
            total: probe.total || 0,
            transferred: 0,
            startedAt: Date.now(),
            status: 'running',
            packagePath,
            extractDir,
            taskCacheDir
        };
        zonePlayDownloads.set(taskId, task);

        sender.send('zp-download-status', { taskId, status: 'downloading', message: `Downloading ${title}...`, packagePath });

        try {
            await new Promise((resolve, reject) => {
                let settled = false;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };

                const fail = (error) => {
                    if (settled) return;
                    settled = true;
                    reject(error);
                };

                const closeWriter = () => {
                    if (!task.writer) return;
                    try { task.writer.end(); } catch (_) {}
                    task.writer = null;
                };

                const getPartialSize = () => {
                    try {
                        return fs.existsSync(packagePath) ? fs.statSync(packagePath).size : 0;
                    } catch (_) {
                        return task.transferred || 0;
                    }
                };

                const startRequest = (offset = 0) => {
                    if (settled || task.status === 'stopped') return;
                    const headers = { 'user-agent': ZP_BZZHR_UA, referer: 'https://steamrip.com/', ...downloadHeaders };
                    if (offset > 0) headers.range = `bytes=${offset}-`;
                    task.status = 'running';
                    task.pausedAt = 0;

                    const request = got.stream(probe.url, { headers, followRedirect: true });
                    task.request = request;
                    let writerReady = false;
                    let baseOffset = offset;

                    request.on('response', (response) => {
                        if (task.status !== 'running') return;
                        const canAppend = baseOffset > 0 && response.statusCode === 206;
                        if (baseOffset > 0 && !canAppend) {
                            baseOffset = 0;
                            task.transferred = 0;
                        }
                        const writer = fs.createWriteStream(packagePath, { flags: canAppend ? 'a' : 'w' });
                        task.writer = writer;
                        writerReady = true;
                        writer.on('error', (error) => {
                            if (task.status === 'paused' || task.status === 'stopped') return;
                            fail(error);
                        });
                        writer.on('finish', () => {
                            if (task.status === 'running') finish();
                        });
                        request.pipe(writer);
                    });

                    request.on('downloadProgress', (p) => {
                        if (task.status !== 'running') return;
                        task.transferred = baseOffset + (p.transferred || 0);
                        task.total = p.total ? baseOffset + p.total : (task.total || probe.total || 0);
                        zpSendProgress(sender, task);
                    });

                    request.on('error', (error) => {
                        if (task.status === 'paused') {
                            closeWriter();
                            return;
                        }
                        if (task.status === 'stopped') return fail(error);
                        fail(error);
                    });

                    request.on('end', () => {
                        if (!writerReady && task.status === 'running') finish();
                    });
                };

                task.pauseDownload = () => {
                    if (task.status !== 'running') return false;
                    task.status = 'paused';
                    task.pausedAt = Date.now();
                    if (task.request) {
                        try { task.request.destroy(new Error('Download paused.')); } catch (_) {}
                    }
                    closeWriter();
                    task.transferred = getPartialSize();
                    return true;
                };

                task.resumeDownload = () => {
                    if (task.status !== 'paused') return false;
                    const pausedFor = task.pausedAt ? Date.now() - task.pausedAt : 0;
                    task.startedAt += pausedFor;
                    const offset = getPartialSize();
                    task.transferred = offset;
                    startRequest(offset);
                    return true;
                };

                startRequest(0);
            });

            const archiveKind = archiveKindFromName || zpArchiveKind(packagePath);
            let exeFiles = [];
            let installed = null;
            if (archiveKind) {
                sender.send('zp-download-status', { taskId, status: 'extracting', message: `Extracting ${fileName}...`, packagePath, extractDir });
                await zpExtractArchive(packagePath, extractDir, sender, task);
                try { await fsPromises.rm(packagePath, { force: true }); } catch (_) {}
                if (taskCacheDir) {
                    try { await fsPromises.rm(taskCacheDir, { recursive: true, force: true }); } catch (_) {}
                }
                exeFiles = zpScanExeFiles(extractDir);
                installed = {
                    id: zpGameId(game),
                    title,
                    download_url: game.download_url,
                    image_url: game.image_url || '',
                    hero_url: game.hero_url || '',
                    category: Array.isArray(game.category) ? game.category : [],
                    packagePath: '',
                    archiveDeleted: true,
                    installDir: extractDir,
                    exeFiles,
                    primaryExe: exeFiles[0] && exeFiles[0].path || '',
                    installedAt: new Date().toISOString()
                };
                const installs = await zpReadInstalls();
                installs[installed.id] = installed;
                await zpWriteInstalls(installs);
            }

            task.status = 'done';
            sender.send('zp-download-status', {
                taskId,
                status: archiveKind ? 'complete' : 'saved',
                message: archiveKind ? 'Download, extraction, and scan complete.' : 'Download complete. This package is not a supported archive, so it was saved without extraction.',
                packagePath,
                extractDir: archiveKind ? extractDir : '',
                exeFiles,
                install: installed
            });
            return { success: true, taskId, packagePath, extractDir: archiveKind ? extractDir : '', exeFiles, install: installed };
        } catch (e) {
            task.status = task.status === 'stopped' ? 'stopped' : 'error';
            if (archiveDownloadedToTemp && packagePath && fs.existsSync(packagePath)) {
                try { await fsPromises.rm(packagePath, { force: true }); } catch (_) {}
            }
            if (task.status === 'stopped' && extractDir && fs.existsSync(extractDir)) {
                try { await fsPromises.rm(extractDir, { recursive: true, force: true }); } catch (_) {}
            }
            if (task.status === 'stopped' && taskCacheDir) {
                try { await fsPromises.rm(taskCacheDir, { recursive: true, force: true }); } catch (_) {}
            }
            sender.send('zp-download-status', { taskId, status: task.status, message: task.status === 'stopped' ? 'Download stopped.' : e.message });
            return { success: false, taskId, status: task.status, stopped: task.status === 'stopped', message: task.status === 'stopped' ? 'Download stopped.' : e.message };
        } finally {
            zonePlayDownloads.delete(taskId);
        }
    });

    ipcMain.handle('zp-pause-download', async (event, taskId) => {
        if (!isUserPremium) return { success: false };
        const task = zonePlayDownloads.get(taskId);
        if (!task || (task.phase && task.phase !== 'downloading')) return { success: false };
        if (typeof task.pauseDownload === 'function') task.pauseDownload();
        else {
            try { task.request.pause(); } catch (_) {}
            task.status = 'paused';
        }
        event.sender.send('zp-download-status', { taskId, status: 'paused', message: 'Download paused.' });
        return { success: true };
    });

    ipcMain.handle('zp-resume-download', async (event, taskId) => {
        if (!isUserPremium) return { success: false };
        const task = zonePlayDownloads.get(taskId);
        if (!task || (task.phase && task.phase !== 'downloading')) return { success: false };
        if (typeof task.resumeDownload === 'function') task.resumeDownload();
        else {
            try { task.request.resume(); } catch (_) {}
            task.status = 'running';
        }
        event.sender.send('zp-download-status', { taskId, status: 'downloading', message: 'Download resumed.' });
        return { success: true };
    });

    ipcMain.handle('zp-stop-download', async (event, taskId) => {
        if (!isUserPremium) return { success: false };
        const task = zonePlayDownloads.get(taskId);
        if (!task) return { success: false };
        task.status = 'stopped';
        if (typeof task.extractCancel === 'function') task.extractCancel();
        if (task.extractProcess) { try { task.extractProcess.kill('SIGTERM'); } catch (_) {} }
        if (task.extractStream) { try { task.extractStream.destroy(zpStoppedError()); } catch (_) {} }
        if (task.request) {
            try { task.request.destroy(new Error('Download stopped.')); } catch (_) {}
        }
        if (task.writer) {
            try { task.writer.destroy(); } catch (_) {}
        }
        if (task.packagePath && fs.existsSync(task.packagePath)) { try { await fsPromises.rm(task.packagePath, { force: true }); } catch (_) {} }
        if (task.extractDir && fs.existsSync(task.extractDir)) { try { await fsPromises.rm(task.extractDir, { recursive: true, force: true }); } catch (_) {} }
        if (task.taskCacheDir && fs.existsSync(task.taskCacheDir)) { try { await fsPromises.rm(task.taskCacheDir, { recursive: true, force: true }); } catch (_) {} }
        event.sender.send('zp-download-status', { taskId, status: 'stopped', message: 'Download stopped.' });
        return { success: true };
    });

    ipcMain.handle('zp-create-desktop-shortcut', async (event, { title, exePath, installId }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            const shortcutPath = await zpCreateDesktopShortcut(title, exePath);
            const install = await zpPatchInstallRecord(installId, {
                primaryExe: exePath,
                desktopShortcut: { path: shortcutPath, exePath, createdAt: new Date().toISOString() }
            });
            return { success: true, shortcutPath, install, message: 'Desktop shortcut created.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('zp-add-to-steam-offline', async (event, { title, exePath, imageUrl, heroUrl, installId }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            const result = await zpAddToSteamOffline(title, exePath, { imageUrl, heroUrl });
            const steamShortcut = {
                shortcutsPath: result.shortcutsPath,
                configDir: result.configDir,
                shortcutKey: result.shortcutKey,
                signedId: result.signedId,
                unsignedId: result.unsignedId,
                ids: [result.signedId, result.unsignedId],
                appName: result.appName,
                exePath: result.exePath,
                createdAt: new Date().toISOString()
            };
            const install = await zpPatchInstallRecord(installId, { primaryExe: exePath, steamShortcut });
            return {
                success: true,
                shortcutsPath: result.shortcutsPath,
                artworkCount: result.artworkCount,
                install,
                message: result.artworkCount > 0
                    ? 'Added to Steam with artwork. Restart Steam if it is already open.'
                    : 'Added to Steam shortcuts. Artwork download failed; restart Steam if it is already open.'
            };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('zp-launch-game', async (event, { exePath }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            zpLaunchGameExe(exePath);
            return { success: true, message: 'Game launched.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('zp-open-install-folder', async (event, { folderPath }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            const rawPath = String(folderPath || '').trim();
            if (!rawPath) return { success: false, message: 'Installed game folder was not found.' };
            const target = path.resolve(rawPath);
            if (!fs.existsSync(target)) return { success: false, message: 'Installed game folder was not found.' };
            const stat = await fsPromises.stat(target);
            const dir = stat.isDirectory() ? target : path.dirname(target);
            const result = await shell.openPath(dir);
            if (result) return { success: false, message: result };
            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('zp-delete-install', async (event, { id }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            const installs = await zpReadInstalls();
            const install = installs[String(id || '')];
            if (!install) return { success: false, message: 'Installed game record was not found.' };

            await zpRemoveDesktopShortcutsForInstall(install);
            await zpRemoveSteamShortcutsForInstall(install);
            const deletedPaths = await zpDeleteInstallFiles(install);
            delete installs[String(id || '')];
            await zpWriteInstalls(installs);
            return { success: true, installs, deletedPaths, message: 'Installed game deleted.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    });
})();

// --------------------------- SOFTWARE LIBRARY MODULE -----------------------
(function setupSoftwareLibraryModule() {
    const SOFTWARE_JSON_URL = 'http://209.46.127.241/gamezonejson/Revised Software.json';
    ipcMain.handle('sw-fetch-software', async () => {
        if (!isUserPremium) return { success: false, error: 'Premium feature only.' };
        try {
            const data = await robustFetchJson(SOFTWARE_JSON_URL);
            return { success: true, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('sw-show-save-dialog', async (event, filename) => await dialog.showSaveDialog(mainWindow, {
        title: 'Save Software', defaultPath: filename,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }]
    }));
    ipcMain.handle('sw-download-file', async (event, { url, savePath }) => {
        if (!isUserPremium) return { success: false, message: 'Premium feature only.' };
        try {
            event.sender.send('sw-download-status', { status: 'downloading', message: 'Starting download...' });
            await new Promise((resolve, reject) => {
                const stream = got.stream(url);
                stream.on('downloadProgress', (p) => event.sender.send('sw-download-progress', p));
                stream.pipe(fs.createWriteStream(savePath)).on('finish', resolve).on('error', reject);
            });
            event.sender.send('sw-download-status', { status: 'success', message: 'Download Complete!' });
            return { success: true };
        } catch (e) {
            if (fs.existsSync(savePath)) { try { fs.unlinkSync(savePath); } catch (err) {} }
            event.sender.send('sw-download-status', { status: 'error', message: `Error: ${e.message}` });
            return { success: false };
        }
    });
})();

// Retro Play catalog, Archive.org session, downloads, and player window.
(() => {
  const fs = require('node:fs');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const http = require('node:http');
  const https = require('node:https');
  const yauzl = require('yauzl');

// Retro Play catalog normalization is kept with the main-process implementation.
  const normalizeArchiveCatalog = (() => {
'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const ITEM_ID = 'retro-roms-best-set';
const CATEGORY_RULES = [
  ['Arcade - Mame', 'mame'],
  ['Atari - 2600', 'atari2600'],
  ['NEC - TurboGrafx CD', 'pce-cd'],
  ['NEC - TurboGrafx-16', 'pce'],
  ['Nintendo - DS', 'nds'],
  ['Nintendo - Game Boy Advance', 'gba'],
  ['Nintendo - Game Boy Color', 'gb'],
  ['Nintendo - Game Boy', 'gb'],
  ['Nintendo - GameCube', 'gamecube'],
  ['Nintendo - N64', 'n64'],
  ['Nintendo - NES', 'nes'],
  ['Nintendo - SNES', 'snes'],
  ['SNK - NEO GEO', 'neogeo'],
  ['Sega - Dreamcast', 'dreamcast'],
  ['Sega - Game Gear', 'segaGG'],
  ['Sega - Genesis', 'segaMD'],
  ['Sega - Master System', 'segaMS'],
  ['Sega - Saturn', 'segaSaturn'],
  ['Sega - Sega CD', 'segaCD'],
  ['Sony - PS1', 'psx'],
  ['Sony - PSP', 'psp']
];

function normalizeArchiveCatalog(rawEntries, systems) {
  if (!Array.isArray(rawEntries)) throw new Error('The Retro Play links file must be a JSON array.');
  const systemById = new Map(systems.map((system) => [system.id, system]));
  const result = [];
  const seen = new Set();

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || '').trim();
    const sourceCategory = String(raw.category || '').trim();
    let thumbnailUrl = '';
    try {
      const thumbnail = new URL(String(raw.thumbnail_url || ''));
      if (thumbnail.protocol === 'https:' && !thumbnail.username && !thumbnail.password) {
        thumbnailUrl = thumbnail.toString();
      }
    } catch (_) {}
    let url;
    try { url = new URL(String(raw.download_url || '')); }
    catch { continue; }

    if (!name || url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'archive.org') continue;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'download' || segments[1] !== ITEM_ID || segments.length < 4) continue;

    let outerName;
    let fileName;
    try {
      outerName = decodeURIComponent(segments[2]);
      fileName = decodeURIComponent(segments[segments.length - 1]);
    } catch { continue; }
    if (!outerName.toLowerCase().endsWith('.zip') || !fileName || fileName !== path.posix.basename(fileName)) continue;

    const systemId = CATEGORY_RULES.find(([prefix]) => outerName.toLowerCase().startsWith(prefix.toLowerCase()))?.[1] || '';
    const system = systemById.get(systemId);
    const extension = path.extname(fileName).toLowerCase();
    const extensionName = extension.slice(1);
    const recognizedFile = Boolean(system && (extension === '.zip' || (system.extensions || []).includes(extensionName)));
    const playable = Boolean(system && system.coreAsset && recognizedFile);
    const downloadUrl = url.toString();
    if (seen.has(downloadUrl)) continue;
    seen.add(downloadUrl);

    result.push({
      id: 'archive-' + crypto.createHash('sha256').update(downloadUrl).digest('hex').slice(0, 20),
      name,
      group: sourceCategory,
      category: systemId,
      systemName: system ? system.name : outerName.replace(/\.zip$/i, ''),
      systemGroup: system ? system.group : sourceCategory,
      core: system ? system.coreAsset || '' : '',
      platform: outerName.replace(/\.zip$/i, ''),
      fileName,
      extension,
      logoFile: (systemId || 'default') + '.png',
      thumbnailUrl,
      downloadUrl,
      source: 'https://archive.org/details/' + ITEM_ID,
      supported: playable
    });
  }

  return result;
}

return normalizeArchiveCatalog;
  })();

  const MAX_ARCHIVE_ENTRIES = 50000;
const MAX_ARCHIVE_UNPACKED_BYTES = 8 * 1024 * 1024 * 1024;
const ACTIVE_STATES = new Set(['queued', 'resolving', 'downloading', 'paused', 'extracting']);

  function registerRetroPlay(deps) {
  const app = deps.app;
  const BrowserWindow = deps.BrowserWindow;
  const BrowserView = deps.BrowserView;
  const ipcMain = deps.ipcMain;
  const session = deps.session;
  const shell = deps.shell;
  const getMainWindow = deps.getMainWindow;
  const isPremium = deps.isPremium;
  const rendererRoot = path.join(__dirname, 'renderer');
  const playerRoot = path.join(rendererRoot, 'retro-player');
  const dataRoot = path.join(app.getPath('userData'), 'GameZoneQAUltimate', 'Retro Play');
  const userResourcesRoot = app.isPackaged
    ? (process.env.PORTABLE_EXECUTABLE_DIR
      ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'resources')
      : process.resourcesPath)
    : dataRoot;
  const gamesRoot = app.isPackaged
    ? path.join(userResourcesRoot, 'retro-player', 'games')
    : path.join(dataRoot, 'games');
  const resourceGamePathPrefix = 'resources:';
  const installsPath = path.join(dataRoot, 'library.json');
  const playerServerConfigPath = path.join(dataRoot, 'player-server.json');
  const tasks = new Map();
  const playerViews = new Map();
  const coreAvailabilityCache = new Map();
  let archiveWindow = null;
  let archivePoll = null;
  let localServer = null;
  let serverOrigin = '';
  let basePath = '';

  const getArchiveSession = () => session.fromPartition('persist:gamezoneqa-archive');

  function requirePremium() {
    if (typeof isPremium === 'function' && !isPremium()) throw new Error('Premium feature only.');
  }

  function safeSlug(value) {
    return String(value || 'game')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'game';
  }

  function pathInside(root, candidate) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  function resolveInside(root, relative) {
    const candidate = path.resolve(root, String(relative || ''));
    if (!pathInside(root, candidate)) throw new Error('The requested path leaves the Retro Play library.');
    return candidate;
  }

  function readSystems() {
    return JSON.parse(fs.readFileSync(path.join(rendererRoot, 'retro-systems.json'), 'utf8'));
  }

  function coresRoot() {
    const resourcesCoreRoot = path.join(process.resourcesPath || '', 'retro-player', 'emulatorjs', 'data', 'cores');
    if (app.isPackaged && fs.existsSync(resourcesCoreRoot)) return resourcesCoreRoot;
    return path.join(playerRoot, 'emulatorjs', 'data', 'cores');
  }

  function coreAssetIsAvailable(core) {
    const coreId = String(core || '').trim();
    if (!coreId) return false;
    if (coreAvailabilityCache.has(coreId)) return coreAvailabilityCache.get(coreId);
    const root = coresRoot();
    const available = [
      '-wasm.data',
      '-thread-wasm.data',
      '-legacy-wasm.data',
      '-thread-legacy-wasm.data'
    ].some((suffix) => fs.existsSync(path.join(root, coreId + suffix)));
    coreAvailabilityCache.set(coreId, available);
    return available;
  }

  function playerViewForWebContents(webContents) {
    for (const [view, entry] of playerViews) {
      if (view.webContents === webContents) return { view, entry };
    }
    return null;
  }

  function closePlayerView(view) {
    const entry = playerViews.get(view);
    if (!entry) return;
    playerViews.delete(view);
    const { parent, resizeView, wasFullScreen } = entry;
    if (parent && !parent.isDestroyed()) {
      parent.removeListener('resize', resizeView);
      try { parent.removeBrowserView(view); } catch (_) {}
      if (parent.isFullScreen() !== wasFullScreen) parent.setFullScreen(wasFullScreen);
      if (parent.isMinimized()) parent.restore();
      parent.show();
    }
    try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch (_) {}
    if (parent && !parent.isDestroyed()) {
      const focusLibrary = () => {
        if (parent.isDestroyed()) return;
        parent.focus();
        parent.webContents.focus();
      };
      parent.webContents.executeJavaScript(
        'if (document.activeElement && document.activeElement instanceof HTMLElement) document.activeElement.blur();'
      ).then(focusLibrary, focusLibrary);
    }
  }

  const RETRO_CATALOG_URL = 'https://raw.githubusercontent.com/luamikare/publuaguifest/refs/heads/main/passby/retro-games.json';
  const RETRO_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
  const catalogCachePath = path.join(dataRoot, 'catalog-cache.json');
  let catalogCache = null;
  let catalogCacheAt = 0;
  let catalogFetchPromise = null;

  async function readCatalog(forceRefresh) {
    if (!forceRefresh && catalogCache && Date.now() - catalogCacheAt < RETRO_CATALOG_CACHE_TTL_MS) {
      return catalogCache;
    }
    if (catalogFetchPromise) return catalogFetchPromise;

    catalogFetchPromise = (async () => {
      try {
        const raw = await got(RETRO_CATALOG_URL, {
          timeout: { request: 20000 },
          retry: { limit: 2 }
        }).json();
        if (!Array.isArray(raw) || !raw.length) throw new Error('The catalog response is not a non-empty JSON array.');
        const games = normalizeArchiveCatalog(raw, readSystems());
        if (!games.length) throw new Error('The catalog response contained no supported games.');
        catalogCache = games;
        catalogCacheAt = Date.now();
        try {
          await fs.promises.mkdir(dataRoot, { recursive: true });
          await fs.promises.writeFile(catalogCachePath, JSON.stringify(raw), 'utf8');
        } catch (cacheError) {
          console.warn('[Retro Play] Could not save catalog cache:', cacheError.message);
        }
        return games;
      } catch (fetchError) {
        try {
          const cachedRaw = JSON.parse(await fs.promises.readFile(catalogCachePath, 'utf8'));
          const cachedGames = normalizeArchiveCatalog(cachedRaw, readSystems());
          if (cachedGames.length) {
            catalogCache = cachedGames;
            catalogCacheAt = Date.now();
            return cachedGames;
          }
        } catch (_) {}
        throw new Error('Could not fetch the Retro Play catalog: ' + (fetchError.message || 'network request failed'));
      } finally {
        catalogFetchPromise = null;
      }
    })();
    return catalogFetchPromise;
  }

  async function readInstalls() {
    try {
      const value = JSON.parse(await fs.promises.readFile(installsPath, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      const systems = readSystems();
      for (const install of Object.values(value)) {
        if (!install || typeof install !== 'object' || Array.isArray(install)) continue;
        const system = systems.find((item) => item.id === install.category) || null;
        const savedCore = String(install.core || '');
        const core = coreAssetIsAvailable(savedCore)
          ? savedCore
          : String(system && system.coreAsset || '');
        const extension = path.extname(String(install.playFile || install.fileName || '')).slice(1).toLowerCase();
        install.core = core;
        install.playable = Boolean(
          system &&
          coreAssetIsAvailable(core) &&
          (system.extensions || []).includes(extension)
        );
      }
      return value;
    } catch (_) {
      return {};
    }
  }

  async function writeInstalls(installs) {
    await fs.promises.mkdir(dataRoot, { recursive: true });
    await fs.promises.writeFile(installsPath, JSON.stringify(installs || {}, null, 2), 'utf8');
  }

  function taskSnapshot(task) {
    return {
      taskId: task.id,
      gameId: task.entry.id,
      name: task.entry.name,
      category: task.entry.category,
      status: task.status,
      phase: task.phase,
      message: task.message,
      transferred: task.transferred || 0,
      total: task.total || 0,
      percent: task.total > 0 ? Math.min(1, (task.transferred || 0) / task.total) : 0,
      error: task.error || ''
    };
  }

  function sendToRenderer(sender, channel, payload) {
    try {
      if (sender && !sender.isDestroyed()) sender.send(channel, payload);
    } catch (_) {}
  }

  function setTaskStatus(task, status, message, extra) {
    task.status = status;
    task.message = message || '';
    sendToRenderer(task.sender, 'retro-play-download-status', Object.assign(taskSnapshot(task), extra || {}));
  }

  function sendTaskProgress(task, force) {
    const now = Date.now();
    if (!force && now - (task.lastProgressAt || 0) < 120) return;
    task.lastProgressAt = now;
    sendToRenderer(task.sender, 'retro-play-download-progress', taskSnapshot(task));
  }

  async function catalogById(id) {
    return (await readCatalog(false)).find((entry) => entry.id === String(id || '')) || null;
  }

  function currentTaskForGame(gameId) {
    return Array.from(tasks.values()).find((task) => task.entry.id === gameId && ACTIVE_STATES.has(task.status)) || null;
  }

  async function archiveStatus() {
    try {
      const cookies = await getArchiveSession().cookies.get({ url: 'https://archive.org' });
      const now = Date.now() / 1000;
      const signedIn = cookies.some((cookie) =>
        /^logged-in-sig\d*$/i.test(String(cookie.name || '')) &&
        (!cookie.expirationDate || Number(cookie.expirationDate) > now)
      );
      return { signedIn: Boolean(signedIn) };
    } catch (_) {
      return { signedIn: false };
    }
  }

  function notifyArchiveStatus() {
    const main = getMainWindow && getMainWindow();
    if (!main || main.isDestroyed()) return;
    archiveStatus().then((status) => sendToRenderer(main.webContents, 'retro-play-archive-status', status));
  }

  async function openArchiveSignIn() {
    requirePremium();
    if (archiveWindow && !archiveWindow.isDestroyed()) {
      archiveWindow.focus();
      return { success: true };
    }

    const parent = getMainWindow && getMainWindow();
    archiveWindow = new BrowserWindow({
      width: 960,
      height: 760,
      minWidth: 700,
      minHeight: 520,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      title: 'Sign in',
      backgroundColor: '#101014',
      autoHideMenuBar: true,
      webPreferences: {
        session: getArchiveSession(),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    archiveWindow.setMenu(null);
    archiveWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    archiveWindow.on('closed', () => {
      archiveWindow = null;
      if (archivePoll) clearInterval(archivePoll);
      archivePoll = null;
      notifyArchiveStatus();
    });

    try {
      await archiveWindow.loadURL('https://archive.org/login');
    } catch (error) {
      try { if (archiveWindow && !archiveWindow.isDestroyed()) archiveWindow.close(); } catch (_) {}
      return { success: false, message: error.message || 'Could not open sign-in.' };
    }

    if (archivePoll) clearInterval(archivePoll);
    archivePoll = setInterval(async () => {
      if (!archiveWindow || archiveWindow.isDestroyed()) return;
      const status = await archiveStatus();
      if (status.signedIn) {
        const signedInWindow = archiveWindow;
        if (archivePoll) clearInterval(archivePoll);
        archivePoll = null;
        setTimeout(() => {
          try { if (signedInWindow && !signedInWindow.isDestroyed()) signedInWindow.close(); } catch (_) {}
        }, 700);
      }
    }, 1500);
    if (archivePoll.unref) archivePoll.unref();
    return { success: true };
  }

  async function signOutOfArchive() {
    requirePremium();
    const archiveSession = getArchiveSession();
    const cookies = await archiveSession.cookies.get({ url: 'https://archive.org' });
    await Promise.all(cookies.map((cookie) => {
      const domain = String(cookie.domain || 'archive.org').replace(/^\./, '');
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cookieUrl = protocol + '//' + domain + (cookie.path || '/');
      return archiveSession.cookies.remove(cookieUrl, cookie.name);
    }));
    if (typeof archiveSession.cookies.flushStore === 'function') {
      await archiveSession.cookies.flushStore();
    }
    if (archiveWindow && !archiveWindow.isDestroyed()) archiveWindow.close();
    notifyArchiveStatus();
    return { success: true };
  }

  function validateArchiveEntry(entry, root, seen) {
    const normalized = String(entry.fileName || '').replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.includes('\u0000')) {
      throw new Error('Downloaded package contains an unsafe file path.');
    }
    const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
    if (!segments.length || segments.includes('..') || segments.some((segment) => /[<>:"|?*]/.test(segment))) {
      throw new Error('Downloaded package contains an unsafe file path.');
    }
    const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
    if (mode === 0o120000) throw new Error('Downloaded package contains a symbolic link.');
    const target = path.resolve(root, ...segments);
    if (!pathInside(root, target)) throw new Error('Downloaded package contains a file outside its destination folder.');
    const key = target.toLowerCase();
    if (seen.has(key)) throw new Error('Downloaded package contains duplicate file paths.');
    seen.add(key);
    return { target: target, isDirectory: normalized.endsWith('/') };
  }

  function extractZipSafely(zipPath, destination, task) {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true, autoClose: false, decodeStrings: true }, (openError, zipfile) => {
        if (openError) { reject(openError); return; }
        task.zipfile = zipfile;
        const entries = [];
        const seen = new Set();
        let unpackedBytes = 0;
        let settled = false;
        const fail = (error) => {
          if (settled) return;
          settled = true;
          task.abortExtract = null;
          try { zipfile.close(); } catch (_) {}
          task.zipfile = null;
          reject(error);
        };
        task.abortExtract = () => fail(new Error('Download canceled.'));
        zipfile.on('error', fail);
        zipfile.on('entry', (entry) => {
          try {
            if (task.cancelled) throw new Error('Download canceled.');
            const validated = validateArchiveEntry(entry, destination, seen);
            entry.targetPath = validated.target;
            entry.isDirectory = validated.isDirectory;
            entries.push(entry);
            if (!entry.isDirectory) unpackedBytes += Number(entry.uncompressedSize) || 0;
            if (entries.length > MAX_ARCHIVE_ENTRIES || unpackedBytes > MAX_ARCHIVE_UNPACKED_BYTES) {
              throw new Error('Downloaded package exceeds the extraction limit.');
            }
            zipfile.readEntry();
          } catch (error) { fail(error); }
        });
        zipfile.on('end', () => {
          if (settled) return;
          task.phase = 'extracting';
          task.transferred = 0;
          task.total = unpackedBytes;
          setTaskStatus(task, 'extracting', 'Extracting downloaded game files...');
          let index = 0;
          const extractNext = () => {
            if (task.cancelled) { fail(new Error('Download canceled.')); return; }
            if (index >= entries.length) {
              settled = true;
              task.abortExtract = null;
              try { zipfile.close(); } catch (_) {}
              task.zipfile = null;
              resolve();
              return;
            }
            const entry = entries[index++];
            if (entry.isDirectory) {
              fs.mkdir(entry.targetPath, { recursive: true }, (error) => error ? fail(error) : extractNext());
              return;
            }
            fs.mkdir(path.dirname(entry.targetPath), { recursive: true }, (mkdirError) => {
              if (mkdirError) { fail(mkdirError); return; }
              zipfile.openReadStream(entry, (streamError, readStream) => {
                if (streamError) { fail(streamError); return; }
                const writer = fs.createWriteStream(entry.targetPath, { flags: 'w' });
                task.extractStream = readStream;
                task.extractWriter = writer;
                readStream.on('data', (chunk) => {
                  task.transferred += chunk.length;
                  sendTaskProgress(task, false);
                });
                readStream.once('error', fail);
                writer.once('error', fail);
                writer.once('finish', () => {
                  task.extractStream = null;
                  task.extractWriter = null;
                  extractNext();
                });
                readStream.pipe(writer);
              });
            });
          };
          extractNext();
        });
        zipfile.readEntry();
      });
    });
  }

  function scanFiles(root) {
    const result = [];
    if (!fs.existsSync(root)) return result;
    const walk = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, item.name);
        if (item.isSymbolicLink()) continue;
        if (item.isDirectory()) walk(fullPath);
        else if (item.isFile()) result.push(fullPath);
      }
    };
    walk(root);
    return result;
  }

  async function extractNestedZips(root, task) {
    for (let depth = 0; depth < 3; depth += 1) {
      if (task.cancelled) throw new Error('Download canceled.');
      const zips = scanFiles(root).filter((filePath) => path.extname(filePath).toLowerCase() === '.zip');
      if (!zips.length) return;
      for (const archivePath of zips) {
        const parent = path.dirname(archivePath);
        const stem = path.basename(archivePath, path.extname(archivePath));
        const destination = path.join(parent, stem + '-extracted');
        if (!pathInside(root, destination)) throw new Error('Invalid nested package destination.');
        await fs.promises.rm(destination, { recursive: true, force: true });
        await fs.promises.mkdir(destination, { recursive: true });
        await extractZipSafely(archivePath, destination, task);
        await fs.promises.rm(archivePath, { force: true });
      }
    }
  }

  function choosePlayFile(files, system) {
    const allowed = new Set((system && system.extensions || []).map((value) => '.' + String(value).toLowerCase()));
    const candidates = files.filter((filePath) => allowed.has(path.extname(filePath).toLowerCase()));
    const priority = ['.cue', '.chd', '.iso', '.pbp', '.nes', '.sfc', '.smc', '.gba', '.gbc', '.gb', '.nds', '.n64', '.z64', '.v64', '.pce', '.a26', '.zip'];
    candidates.sort((a, b) => {
      const pa = priority.indexOf(path.extname(a).toLowerCase());
      const pb = priority.indexOf(path.extname(b).toLowerCase());
      return (pa < 0 ? 100 : pa) - (pb < 0 ? 100 : pb) || a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return candidates[0] || '';
  }

  function fileNameFromUrl(url, fallback) {
    try {
      const pathname = new URL(url).pathname;
      const name = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
      return path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function installPath(record, key) {
    const relativePath = String(record && record[key] || '');
    if (!relativePath) return '';
    if (relativePath.startsWith(resourceGamePathPrefix)) {
      const gameRelativePath = relativePath.slice(resourceGamePathPrefix.length).replace(/^[/\\]+/, '');
      return resolveInside(gamesRoot, gameRelativePath);
    }
    return resolveInside(dataRoot, relativePath);
  }

  function storedGamePath(absolutePath) {
    if (!pathInside(gamesRoot, absolutePath)) throw new Error('The installed game path leaves the Retro Play games folder.');
    return resourceGamePathPrefix + path.relative(gamesRoot, absolutePath).split(path.sep).join('/');
  }

  function installSnapshot(install) {
    return {
      id: install.id,
      name: install.name,
      category: install.category,
      systemName: install.systemName,
      systemGroup: install.systemGroup,
      logoFile: install.logoFile,
      playable: Boolean(install.playable),
      gameDir: install.gameDir,
      installedAt: install.installedAt
    };
  }

  async function persistInstall(task, playPath, system, core) {
    const installs = await readInstalls();
    const relativePlayFile = storedGamePath(playPath);
    const extension = path.extname(playPath).slice(1).toLowerCase();
    const playableExtension = Boolean(system && (system.extensions || []).includes(extension));
    const corePresent = coreAssetIsAvailable(core);
    const install = {
      id: task.entry.id,
      catalogId: task.entry.id,
      name: task.entry.name,
      category: task.entry.category,
      group: task.entry.group,
      systemName: task.entry.systemName,
      systemGroup: task.entry.systemGroup,
      logoFile: task.entry.logoFile,
      core: core,
      playable: Boolean(task.entry.supported && corePresent && playableExtension),
      gameDir: storedGamePath(task.targetDir),
      playFile: relativePlayFile,
      fileName: path.basename(playPath),
      downloadUrl: task.entry.downloadUrl,
      installedAt: new Date().toISOString()
    };
    installs[install.id] = install;
    await writeInstalls(installs);
    task.install = install;
    task.phase = 'complete';
    setTaskStatus(task, 'complete', 'Installed ' + task.entry.name + '.', { install: installSnapshot(install) });
    return install;
  }

  async function finishInstall(task, packagePath) {
    const systems = readSystems();
    const system = systems.find((item) => item.id === task.entry.category) || null;
    const core = system && system.coreAsset || '';
    const isCoreZip = path.extname(packagePath).toLowerCase() === '.zip' && core === 'mame2003_plus';
    let playPath = packagePath;

    if (path.extname(packagePath).toLowerCase() === '.zip' && !isCoreZip) {
      const extractedRoot = path.join(task.targetDir, 'extracted');
      await fs.promises.rm(extractedRoot, { recursive: true, force: true });
      await fs.promises.mkdir(extractedRoot, { recursive: true });
      await extractZipSafely(packagePath, extractedRoot, task);
      await extractNestedZips(extractedRoot, task);
      const extractedFiles = scanFiles(extractedRoot);
      playPath = choosePlayFile(extractedFiles, system) || extractedFiles[0] || packagePath;
      if (extractedFiles.length && playPath !== packagePath) {
        await fs.promises.rm(packagePath, { force: true });
      }
    }
    return persistInstall(task, playPath, system, core);
  }

  function responseHeader(response, headerName) {
    const headers = response && response.headers || {};
    const value = headers[String(headerName).toLowerCase()];
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  function isArchiveHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'archive.org' || host.endsWith('.archive.org');
  }

  async function openArchiveResponse(task, startOffset, redirects) {
    if (task.cancelled) throw new Error('Download canceled.');
    if ((redirects || 0) > 6) throw new Error('The download server redirected the request too many times.');

    let url;
    try { url = new URL(task.currentDownloadUrl || task.entry.downloadUrl); }
    catch (_) { throw new Error('The download URL is invalid.'); }
    if (url.protocol !== 'https:' || url.username || url.password || !isArchiveHost(url.hostname)) {
      throw new Error('This download link is not supported.');
    }

    const archiveSession = getArchiveSession();
    const headers = {
      'User-Agent': archiveSession.getUserAgent(),
      Referer: 'https://archive.org/',
      Accept: '*/*',
      'Accept-Encoding': 'identity'
    };
    if (startOffset > 0) headers.Range = 'bytes=' + startOffset + '-';
    const cookies = await archiveSession.cookies.get({ url: url.toString() });
    if (task.cancelled) throw new Error('Download canceled.');
    if (cookies.length) {
      headers.Cookie = cookies
        .sort((a, b) => String(b.path || '').length - String(a.path || '').length)
        .map((cookie) => String(cookie.name) + '=' + String(cookie.value))
        .join('; ');
    }

    return new Promise((resolve, reject) => {
      const request = https.get(url, { headers, timeout: 45000 }, (response) => {
        const statusCode = Number(response.statusCode || 0);
        if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
          response.resume();
          if ((redirects || 0) >= 6) {
            reject(new Error('The download server redirected the request too many times.'));
            return;
          }
          try {
            task.currentDownloadUrl = new URL(response.headers.location, url).toString();
          } catch (_) {
            reject(new Error('The download server returned an invalid redirect.'));
            return;
          }
          openArchiveResponse(task, startOffset, (redirects || 0) + 1).then(resolve, reject);
          return;
        }
        task.response = response;
        resolve({ request: request, response: response, url: url });
      });
      task.request = request;
      request.once('timeout', () => request.destroy(new Error('The download connection timed out.')));
      request.once('error', reject);
    });
  }

  function downloadToPartial(task) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let startOffset = 0;
      try { startOffset = fs.existsSync(task.partialPath) ? fs.statSync(task.partialPath).size : 0; } catch (_) {}
      const finish = (error) => {
        if (settled) return;
        settled = true;
        task.failDownload = null;
        if (error) reject(error);
        else resolve();
      };
      task.failDownload = (error) => finish(error || new Error('Download stopped.'));
      task.transferred = startOffset;

      task.currentDownloadUrl = task.entry.downloadUrl;
      const responsePromise = openArchiveResponse(task, startOffset, 0);
      responsePromise.then(({ response }) => {
        if (task.cancelled) {
          response.destroy();
          finish(new Error('Download canceled.'));
          return;
        }
        task.response = response;
        const statusCode = Number(response.statusCode || 0);
        const contentType = responseHeader(response, 'content-type').toLowerCase();
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          const detail = statusCode === 401 || statusCode === 403
            ? archiveStatus().then((status) => status.signedIn
              ? 'The download server denied this file (HTTP ' + statusCode + '). Retro Play sent its signed-in session; this item may be restricted or unavailable to the account.'
              : 'The download server returned HTTP ' + statusCode + '. Use the sign-in button, then retry.')
            : 'The download server returned HTTP ' + statusCode + '.';
          Promise.resolve(detail).then((message) => finish(new Error(message)));
          return;
        }
        if (/text\/html/.test(contentType)) {
          response.resume();
          archiveStatus().then((status) => finish(new Error(status.signedIn
            ? 'The download link returned a web page instead of a game file. This item may require a different direct file link.'
            : 'The download link returned a web page instead of a game file. Use the sign-in button, then retry.')));
          return;
        }

        const contentRange = responseHeader(response, 'content-range');
        const totalMatch = /\/(\d+)$/.exec(contentRange);
        const contentLength = Number(responseHeader(response, 'content-length') || 0);
        const append = startOffset > 0 && statusCode === 206;
        if (startOffset > 0 && !append) startOffset = 0;
        task.transferred = startOffset;
        task.total = totalMatch ? Number(totalMatch[1]) : (append ? startOffset + contentLength : contentLength);
        const writer = fs.createWriteStream(task.partialPath, { flags: append ? 'a' : 'w' });
        task.writer = writer;
        setTaskStatus(task, 'downloading', 'Downloading ' + task.entry.name + '...');
        response.on('data', (chunk) => {
          task.transferred += chunk.length;
          if (task.status === 'downloading') sendTaskProgress(task, false);
        });
        response.once('error', (error) => {
          if (task.cancelled) return finish(new Error('Download canceled.'));
          if (task.status === 'paused') return;
          finish(error);
        });
        writer.once('error', (error) => {
          if (task.cancelled) return finish(new Error('Download canceled.'));
          finish(error);
        });
        writer.once('finish', () => {
          if (task.cancelled) return finish(new Error('Download canceled.'));
          if (task.status === 'paused') return;
          sendTaskProgress(task, true);
          finish();
        });
        response.pipe(writer);
      }, (error) => {
        if (task.cancelled) return finish(new Error('Download canceled.'));
        if (task.status === 'paused') return;
        finish(error);
      });
    });
  }

  async function runDownload(task) {
    const packagePath = path.join(task.targetDir, task.entry.fileName);
    try {
      await fs.promises.mkdir(task.targetDir, { recursive: true });
      if (!fs.existsSync(packagePath)) {
        task.phase = 'resolving';
        setTaskStatus(task, 'resolving', 'Connecting to download server...');
        await downloadToPartial(task);
        if (task.cancelled) throw new Error('Download canceled.');
        const partialStat = await fs.promises.stat(task.partialPath);
        if (!partialStat.size) throw new Error('The download server returned an empty file.');
        await fs.promises.rename(task.partialPath, packagePath);
        task.writer = null;
      }
      if (task.cancelled) throw new Error('Download canceled.');
      task.phase = 'installing';
      setTaskStatus(task, 'extracting', 'Preparing ' + task.entry.name + ' for play...');
      await finishInstall(task, packagePath);
    } catch (error) {
      const canceled = task.cancelled || error.message === 'Download canceled.';
      task.error = canceled ? '' : String(error && error.message || 'Download failed.');
      task.phase = canceled ? 'canceled' : 'error';
      try { if (task.request) task.request.abort(); } catch (_) {}
      try { if (task.response) task.response.destroy(); } catch (_) {}
      try { if (task.writer) task.writer.destroy(); } catch (_) {}
      try { if (task.extractStream) task.extractStream.destroy(); } catch (_) {}
      try { if (task.extractWriter) task.extractWriter.destroy(); } catch (_) {}
      try { if (task.abortExtract) task.abortExtract(); } catch (_) {}
      try { if (task.zipfile) task.zipfile.close(); } catch (_) {}
      if (canceled) {
        try { await fs.promises.rm(task.targetDir, { recursive: true, force: true }); } catch (_) {}
      }
      setTaskStatus(task, canceled ? 'canceled' : 'error', canceled ? 'Download canceled.' : task.error);
    } finally {
      task.request = null;
      task.response = null;
      task.writer = null;
      task.extractStream = null;
      task.extractWriter = null;
      task.zipfile = null;
      task.abortExtract = null;
      task.failDownload = null;
    }
  }

  function mimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.wasm': 'application/wasm',
      '.data': 'application/octet-stream',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.txt': 'text/plain; charset=utf-8',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    return map[ext] || 'application/octet-stream';
  }

  function sendJson(response, statusCode, value) {
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(value));
  }

  function setIsolationHeaders(response) {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
  }

  function serveLocalFile(request, response, filePath) {
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeType(filePath),
        'Content-Length': stat.size,
        'Cache-Control': 'no-store'
      });
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => { try { response.destroy(); } catch (_) {} });
      stream.pipe(response);
    });
  }

  function handlePlayerRequest(request, response) {
    setIsolationHeaders(response);
    let requestUrl;
    try { requestUrl = new URL(request.url, serverOrigin); }
    catch (_) { response.writeHead(400).end('Bad request'); return; }

    if (requestUrl.pathname === basePath + '/api/game') {
      const id = String(requestUrl.searchParams.get('id') || '');
      readInstalls().then((installs) => {
        const install = installs[id];
        if (!install || !install.playable) { sendJson(response, 404, { error: 'This game has no bundled player core.' }); return; }
        const playPath = installPath(install, 'playFile');
        if (!playPath || !fs.existsSync(playPath)) { sendJson(response, 404, { error: 'The installed game file could not be found.' }); return; }
        sendJson(response, 200, {
          id: install.id,
          title: install.name,
          systemName: install.systemName,
          core: install.core,
          fileName: path.basename(playPath)
        });
      }).catch((error) => sendJson(response, 500, { error: error.message }));
      return;
    }

    if (requestUrl.pathname === basePath + '/api/rom') {
      const id = String(requestUrl.searchParams.get('id') || '');
      readInstalls().then((installs) => {
        const install = installs[id];
        if (!install || !install.playable) { response.writeHead(404).end('Game not found'); return; }
        const playPath = installPath(install, 'playFile');
        if (!playPath || !fs.existsSync(playPath)) { response.writeHead(404).end('Game file not found'); return; }
        serveLocalFile(request, response, playPath);
      }).catch(() => response.writeHead(500).end('Could not open game file'));
      return;
    }

    const prefix = basePath + '/';
    if (!requestUrl.pathname.startsWith(prefix)) {
      response.writeHead(404).end('Not found');
      return;
    }
    let relative;
    try { relative = decodeURIComponent(requestUrl.pathname.slice(prefix.length)); }
    catch (_) { response.writeHead(400).end('Bad path'); return; }
    if (!relative) relative = 'player.html';
    const coreAssetPrefix = 'emulatorjs/data/cores/';
    const normalizedRelative = relative.replace(/\\/g, '/');
    let assetRoot = playerRoot;
    let assetRelative = relative;
    if (normalizedRelative.startsWith(coreAssetPrefix)) {
      assetRoot = coresRoot();
      assetRelative = normalizedRelative.slice(coreAssetPrefix.length);
    }
    let filePath;
    try { filePath = resolveInside(assetRoot, assetRelative); }
    catch (_) { response.writeHead(403).end('Forbidden'); return; }
    serveLocalFile(request, response, filePath);
  }

  function startPlayerServer() {
    if (localServer && serverOrigin && basePath) return Promise.resolve();
    return new Promise((resolve, reject) => {
      localServer = http.createServer(handlePlayerRequest);
      const listenOn = (port) => {
        const onListening = () => {
          localServer.removeListener('error', onError);
          const address = localServer.address();
          serverOrigin = 'http://127.0.0.1:' + address.port;
          basePath = '/retro-' + crypto.randomBytes(12).toString('hex');
          try {
            fs.mkdirSync(dataRoot, { recursive: true });
            fs.writeFileSync(playerServerConfigPath, JSON.stringify({ port: address.port }), 'utf8');
          } catch (_) {}
          resolve();
        };
        const onError = (error) => {
          localServer.removeListener('listening', onListening);
          localServer.removeListener('error', onError);
          if (port && error.code === 'EADDRINUSE') {
            listenOn(0);
            return;
          }
          localServer = null;
          reject(error);
        };
        localServer.once('error', onError);
        localServer.once('listening', onListening);
        localServer.listen(port, '127.0.0.1');
      };
      let savedPort = 0;
      try {
        const saved = JSON.parse(fs.readFileSync(playerServerConfigPath, 'utf8'));
        if (Number.isInteger(saved.port) && saved.port > 0 && saved.port <= 65535) savedPort = saved.port;
      } catch (_) {}
      listenOn(savedPort);
    });
  }

  async function launchInstalled(gameId) {
    const installs = await readInstalls();
    const install = installs[String(gameId || '')];
    if (!install) throw new Error('This game is not installed.');
    const playPath = installPath(install, 'playFile');
    if (!playPath || !fs.existsSync(playPath)) throw new Error('The installed game file could not be found.');

    if (!install.playable || !install.core) {
      const errorText = await shell.openPath(playPath);
      if (errorText) throw new Error(errorText);
      return { success: true, external: true };
    }

    await startPlayerServer();
    const parent = getMainWindow && getMainWindow();
    if (!parent || parent.isDestroyed()) throw new Error('The GameZoneQA main window is unavailable.');
    const playerView = new BrowserView({
      webPreferences: {
        preload: gameZonePlayerPreload('retro'),
        partition: 'persist:gamezoneqa-retro-player',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    const resizeView = () => {
      if (parent.isDestroyed() || playerView.webContents.isDestroyed()) return;
      const [width, height] = parent.getContentSize();
      playerView.setBounds({ x: 0, y: 0, width, height });
    };
    playerViews.set(playerView, { parent, resizeView, wasFullScreen: parent.isFullScreen() });
    parent.addBrowserView(playerView);
    playerView.setAutoResize({ width: true, height: true });
    parent.on('resize', resizeView);
    resizeView();
    playerView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    try {
      await playerView.webContents.loadURL(serverOrigin + basePath + '/player.html?id=' + encodeURIComponent(install.id));
      playerView.webContents.focus();
    } catch (error) {
      closePlayerView(playerView);
      throw error;
    }
    return { success: true, external: false, embedded: true };
  }

  ipcMain.on('retro-player-close', (event) => {
    const player = playerViewForWebContents(event.sender);
    if (player) closePlayerView(player.view);
  });

  ipcMain.on('retro-player-toggle-fullscreen', (event) => {
    const player = playerViewForWebContents(event.sender);
    if (!player || player.entry.parent.isDestroyed()) return;
    player.entry.parent.setFullScreen(!player.entry.parent.isFullScreen());
  });

  ipcMain.handle('retro-play-fetch', async () => {
    try {
      requirePremium();
      const games = await readCatalog(true);
      const installs = await readInstalls();
      return {
        success: true,
        games: games,
        installs: installs,
        tasks: Array.from(tasks.values()).map(taskSnapshot),
        archive: await archiveStatus()
      };
    } catch (error) {
      return { success: false, games: [], installs: {}, message: error.message || 'Could not load Retro Play.' };
    }
  });

  ipcMain.handle('retro-play-sign-in', async () => {
    try { return await openArchiveSignIn(); }
    catch (error) { return { success: false, message: error.message || 'Could not open sign-in.' }; }
  });

  ipcMain.handle('retro-play-sign-out', async () => {
    try { return await signOutOfArchive(); }
    catch (error) { return { success: false, message: error.message || 'Could not sign out.' }; }
  });

  ipcMain.handle('retro-play-auth-status', async () => archiveStatus());

  ipcMain.handle('retro-play-open-library', async () => {
    try {
      requirePremium();
      await fs.promises.mkdir(gamesRoot, { recursive: true });
      const errorText = await shell.openPath(gamesRoot);
      return errorText ? { success: false, message: errorText } : { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Could not open the Retro Play folder.' };
    }
  });

  ipcMain.handle('retro-play-start', async (event, gameId) => {
    try {
      requirePremium();
      const entry = await catalogById(gameId);
      if (!entry) throw new Error('This game is not in the Retro Play catalog.');
      const installs = await readInstalls();
      if (installs[entry.id]) throw new Error('This game is already installed.');
      if (currentTaskForGame(entry.id)) throw new Error('This game is already downloading.');
      const busy = Array.from(tasks.values()).find((task) => ACTIVE_STATES.has(task.status));
      if (busy) throw new Error('Finish or stop the current download before starting another game.');

      const systems = readSystems();
      const system = systems.find((item) => item.id === entry.category) || null;
      const targetDir = path.resolve(gamesRoot, safeSlug(entry.category || entry.systemGroup), safeSlug(entry.name) + '-' + entry.id.slice(-6));
      if (!pathInside(gamesRoot, targetDir)) throw new Error('Invalid game destination.');
      const task = {
        id: crypto.randomUUID(),
        entry: Object.assign({}, entry, {
          fileName: fileNameFromUrl(entry.downloadUrl, safeSlug(entry.name) + (entry.extension || '.rom'))
        }),
        system: system,
        sender: event.sender,
        targetDir: targetDir,
        partialPath: '',
        status: 'queued',
        phase: 'queued',
        message: 'Waiting to start...',
        transferred: 0,
        total: 0,
        cancelled: false
      };
      task.partialPath = path.join(targetDir, task.entry.fileName + '.part');
      tasks.set(task.id, task);
      setTaskStatus(task, 'queued', 'Starting download...');
      task.startTimer = setTimeout(() => {
        task.startTimer = null;
        if (task.cancelled) return;
        task.runPromise = runDownload(task);
      }, 30);
      return { success: true, taskId: task.id };
    } catch (error) {
      return { success: false, message: error.message || 'Could not start the download.' };
    }
  });

  ipcMain.handle('retro-play-pause', async (event, taskId) => {
    const task = tasks.get(String(taskId || ''));
    if (!task || task.sender !== event.sender || task.status !== 'downloading' || !task.response) return { success: false };
    task.status = 'paused';
    task.response.pause();
    setTaskStatus(task, 'paused', 'Download paused.');
    return { success: true };
  });

  ipcMain.handle('retro-play-resume', async (event, taskId) => {
    const task = tasks.get(String(taskId || ''));
    if (!task || task.sender !== event.sender || task.status !== 'paused' || !task.response) return { success: false };
    task.status = 'downloading';
    task.response.resume();
    setTaskStatus(task, 'downloading', 'Download resumed.');
    return { success: true };
  });

  ipcMain.handle('retro-play-stop', async (event, taskId) => {
    const task = tasks.get(String(taskId || ''));
    if (!task || task.sender !== event.sender || !ACTIVE_STATES.has(task.status)) return { success: false };
    task.cancelled = true;
    setTaskStatus(task, 'canceling', 'Stopping and removing the partial download...');
    if (task.startTimer) {
      clearTimeout(task.startTimer);
      task.startTimer = null;
    }
    try { if (task.failDownload) task.failDownload(new Error('Download canceled.')); } catch (_) {}
    try { if (task.abortExtract) task.abortExtract(); } catch (_) {}
    try { if (task.request) task.request.abort(); } catch (_) {}
    try { if (task.response) task.response.destroy(); } catch (_) {}
    try { if (task.writer) task.writer.destroy(); } catch (_) {}
    try { if (task.extractStream) task.extractStream.destroy(); } catch (_) {}
    try { if (task.extractWriter) task.extractWriter.destroy(); } catch (_) {}
    try { if (task.zipfile) task.zipfile.close(); } catch (_) {}
    if (!task.runPromise) {
      await fs.promises.rm(task.targetDir, { recursive: true, force: true }).catch(() => {});
      setTaskStatus(task, 'canceled', 'Download canceled.');
    }
    return { success: true };
  });

  ipcMain.handle('retro-play-launch', async (_event, gameId) => {
    try {
      requirePremium();
      return await launchInstalled(gameId);
    } catch (error) {
      return { success: false, message: error.message || 'Could not start the game.' };
    }
  });

  ipcMain.handle('retro-play-open-game-folder', async (_event, gameId) => {
    try {
      requirePremium();
      const installs = await readInstalls();
      const install = installs[String(gameId || '')];
      if (!install) throw new Error('This game is not installed.');
      const gameDir = installPath(install, 'gameDir');
      if (!gameDir || !fs.existsSync(gameDir)) throw new Error('The installed game folder could not be found.');
      const errorText = await shell.openPath(gameDir);
      return errorText ? { success: false, message: errorText } : { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Could not open the game folder.' };
    }
  });

  ipcMain.handle('retro-play-delete', async (_event, gameId) => {
    try {
      requirePremium();
      const id = String(gameId || '');
      const installs = await readInstalls();
      const install = installs[id];
      if (!install) throw new Error('This game is not installed.');
      const gameDir = installPath(install, 'gameDir');
      if (fs.existsSync(gameDir)) {
        if (fs.lstatSync(gameDir).isSymbolicLink()) throw new Error('The installed game folder is a symbolic link.');
        await fs.promises.rm(gameDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      }
      delete installs[id];
      await writeInstalls(installs);
      return { success: true, installs: installs };
    } catch (error) {
      return { success: false, message: error.message || 'Could not uninstall this game.' };
    }
  });

  app.on('before-quit', () => {
    if (archivePoll) clearInterval(archivePoll);
    archivePoll = null;
    try { if (localServer) localServer.close(); } catch (_) {}
    localServer = null;
  });
}

  registerRetroPlay({
    app,
    BrowserWindow,
    BrowserView,
    ipcMain,
    session,
    net,
    shell,
    getMainWindow: () => mainWindow,
    isPremium: () => isUserPremium
  });
})();
