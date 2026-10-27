// your-app-name/renderer/renderer.js
// Get all DOM elements once at the top for efficiency
const steamActionButtonText = document.getElementById('steamActionButtonText');
const appHeader = document.getElementById('appHeader');
const appIdInput = document.getElementById('appIdInput');
const processAppIdButton = document.getElementById('processAppIdButton');
const deleteIdButton = document.getElementById('deleteIdButton');
const statusArea = document.getElementById('statusArea');
const authSection = document.getElementById('authSection');
const authInitialMessage = document.getElementById('authInitialMessage');
const authLoader = document.getElementById('authLoader');
const authFormElements = document.getElementById('authFormElements');
const authReadme = document.getElementById('authReadme');
const authCodeInput = document.getElementById('authCodeInput');
const submitAuthButton = document.getElementById('submitAuthButton');
const continueGuestButton = document.getElementById('continueGuestButton');
const authStatus = document.getElementById('authStatus');
const changeDeviceButton = document.getElementById('changeDeviceButton');
const changeDeviceModal = document.getElementById('changeDeviceModal');
const closeChangeDeviceModalButton = document.getElementById('closeChangeDeviceModal');
const changeDeviceAuthCodeInput = document.getElementById('changeDeviceAuthCodeInput');
const submitChangeDeviceButton = document.getElementById('submitChangeDeviceButton');
const changeDeviceStatus = document.getElementById('changeDeviceStatus');
const steamFixButton = document.getElementById('steamFixButton');
const vpnFooterButton = document.getElementById('vpnFooterButton');
const steamFixFooterButton = document.getElementById('steamFixFooterButton');
const stopSteamFooterButton = document.getElementById('stopSteamFooterButton');
const contentAreaFooter = document.getElementById('contentAreaFooter');
const oldSteamButton = document.getElementById('oldSteamButton');
const removeOldSteamButton = document.getElementById('removeOldSteamButton');
const temporaryFixContainer = document.getElementById('temporaryFixContainer');
const mainAppSection = document.getElementById('mainAppSection');
const membershipBadge = document.getElementById('membershipBadge');
const steamActionButton = document.getElementById('steamActionButton');
const setSaveLocationButton = document.getElementById('setSaveLocationButton');
const currentSavePathInput = document.getElementById('currentSavePathInput');
const autoPlaceToggle = document.getElementById('autoPlaceToggle');
const dlcModeToggle = document.getElementById('dlcModeToggle');
const unlockGameToggle = document.getElementById('unlockGameToggle');
const unlockGameToggleContainer = document.getElementById('unlockGameToggleContainer');
const menuLogsButton = document.getElementById('menuLogsButton');
const logsView = document.getElementById('logsView');
const dragDropArea = document.getElementById('dragDropArea');
const fileInputHidden = document.getElementById('fileInputHidden');
const browseFilesButton = document.getElementById('browseFilesButton');
const menuHomeButton = document.getElementById('menuHomeButton');
const menuGamelistButton = document.getElementById('menuGamelistButton');
const menuLibraryButton = document.getElementById('menuLibraryButton');
const menuSteamlessButton = document.getElementById('menuSteamlessButton');
const menuSettingsButton = document.getElementById('menuSettingsButton');
const menuLogoutButton = document.getElementById('menuLogoutButton');
const titleBarVersion = document.getElementById('titleBarVersion');

const menuLiveChatButton = document.getElementById('menuLiveChatButton');
const liveChatView = document.getElementById('liveChatView');
const appChatMessages = document.getElementById('appChatMessages');
const appChatTextInput = document.getElementById('appChatTextInput');
const appChatSendBtn = document.getElementById('appChatSendBtn');
const appChatAttachBtn = document.getElementById('appChatAttachBtn');
const appChatFileInput = document.getElementById('appChatFileInput');
const chatTypingIndicator = document.getElementById('chatTypingIndicator');
const appChatUnreadBadge = document.getElementById('appChatUnreadBadge');

let chatSocket = null;
let chatUserCode = null;
let appChatUnreadCount = 0;
let CHAT_SERVER_URL = '';   // populated from compiled main via app-get-config

// Loads the chat server URL from main and pulls in the Socket.IO client from it
// (replaces the old static <script> tag, so the address isn't in plain HTML/JS).
let _chatConfigPromise = null;
function ensureChatConfig() {
    if (!_chatConfigPromise) {
        _chatConfigPromise = (async () => {
            try {
                const cfg = await window.electronAPI.invoke('app-get-config');
                CHAT_SERVER_URL = (cfg && cfg.chatServer) || '';
            } catch (e) { console.error('[LiveChat] config load failed:', e && e.message); }
        })();
    }
    return _chatConfigPromise;
}
ensureChatConfig();

const homeView = document.getElementById('homeView');
const gamelistView = document.getElementById('gamelistView');
const libraryView = document.getElementById('libraryView');
const steamlessView = document.getElementById('steamlessView');
const dlcView = document.getElementById('dlcView');
const settingsView = document.getElementById('settingsView');
const expirationStatusDisplay = document.getElementById('expirationStatusDisplay');
const productLibraryView = document.getElementById('productLibraryView');
const gameLibraryView = document.getElementById('gameLibraryView');
const softwareLibraryView = document.getElementById('softwareLibraryView');
const websitesView = document.getElementById('websitesView');
const drmView = document.getElementById('drmView');
const zonePlayView = document.getElementById('zonePlayView');
const retroPlayView = document.getElementById('retroPlayView');
const watchZoneView = document.getElementById('watchZoneView');

// Game List View Elements
const gamelistSearchView = document.getElementById('gamelistSearchView');
const gamelistSearchButton = document.getElementById('gamelistSearchButton');
const gamelistStatusMessage = document.getElementById('gamelistStatusMessage');
const gamelistGameList = document.getElementById('gamelistGameList');
const gamelistCategoryStrip = document.getElementById('gamelistCategoryStrip');
const gamelistCategoryScroller = document.getElementById('gamelistCategoryScroller');
const gamelistCategoryPrev = document.getElementById('gamelistCategoryPrev');
const gamelistCategoryNext = document.getElementById('gamelistCategoryNext');
const gamelistSortSelect = document.getElementById('gamelistSortSelect');
const gamelistSortButton = document.getElementById('gamelistSortButton');
const gamelistSortButtonText = document.getElementById('gamelistSortButtonText');
const gamelistSortOptions = document.getElementById('gamelistSortOptions');
const gamelistPlayableSelect = document.getElementById('gamelistPlayableSelect');
const gamelistPlayableButton = document.getElementById('gamelistPlayableButton');
const gamelistPlayableButtonText = document.getElementById('gamelistPlayableButtonText');
const gamelistPlayableOptions = document.getElementById('gamelistPlayableOptions');
const gamelistClearFilterButton = document.getElementById('gamelistClearFilterButton');

// DLC View Elements
const dlcSearchView = document.getElementById('dlcSearchView');
const dlcSearchButton = document.getElementById('dlcSearchButton');
const dlcRefreshButton = document.getElementById('dlcRefreshButton');
const dlcGameList = document.getElementById('dlcGameList');
const dlcStatusMessage = document.getElementById('dlcStatusMessage');
let activeDlcCardButtons = null;

// Steamless Helper View Elements
const steamlessSearchView = document.getElementById('steamlessSearchView');
const steamlessSearchButton = document.getElementById('steamlessSearchButton');
const steamlessRefreshButton = document.getElementById('steamlessRefreshButton');
const steamlessGameList = document.getElementById('steamlessGameList');
const steamlessStatusMessage = document.getElementById('steamlessStatusMessage');
let steamlessGamesCache = [];

// Library View Elements
const librarySearchView = document.getElementById('librarySearchView');
const libraryRefreshButton = document.getElementById('libraryRefreshButton');
const libraryGameList = document.getElementById('libraryGameList');
const libraryStatusMessage = document.getElementById('libraryStatusMessage');

// Update View Elements
const menuUpdateButton = document.getElementById('menuUpdateButton');
const updateView = document.getElementById('updateView');
const updateSearchView = document.getElementById('updateSearchView');
const updateRefreshButton = document.getElementById('updateRefreshButton');
const updateGameList = document.getElementById('updateGameList');
const updateStatusMessage = document.getElementById('updateStatusMessage');

const menuOnlineButton = document.getElementById('menuOnlineButton');
const onlineView = document.getElementById('onlineView');


// Premium feature containers & Version Status Indicator
const autoPlaceToggleContainer = document.getElementById('autoPlaceToggleContainer');
const dlcToggleContainer = document.getElementById('dlcToggleContainer');
const versionStatusIndicator = document.getElementById('versionStatusIndicator');
const advancedSteamtoolsManagementContainer = document.getElementById('advancedSteamtoolsManagementContainer');

// Buttons for advanced management
const openSteamConfigButton = document.getElementById('openSteamConfigButton');
const wipeSteamtoolsButton = document.getElementById('wipeSteamtoolsButton');
const fixSteamtoolsButton = document.getElementById('fixSteamtoolsButton');
const stopSteamButton = document.getElementById('stopSteamButton');

// Change Device Modal Elements (Declared at the top)

const pageBottomRightButtonContainer = document.getElementById('pageBottomRightButtonContainer');

// Custom Title Bar Elements
const closeAppButton = document.getElementById('closeAppButton');


const STEAM_ICON_CLASS = 'fab fa-steam';
const PROCESSING_ICON_CLASS = 'fas fa-spinner fa-spin';
const ERROR_ICON_CLASS = 'fas fa-exclamation-triangle';
const ADD_ICON_CLASS = 'fas fa-plus-circle';
const GAME_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' rx='10' fill='%2317171c'/%3E%3Crect x='1' y='1' width='318' height='178' rx='10' fill='none' stroke='%232a2a32'/%3E%3Cpath d='M106 108h108v16H106zM128 68h64v22h-64z' fill='%23343943'/%3E%3Ccircle cx='118' cy='78' r='8' fill='%23343943'/%3E%3C/svg%3E";

let lastProgressMessageElement = null;
let authStatusTimeout = null;
let libraryGamesCache = [];
let libraryBypassGamesCache = [];
let libraryBypassGamesLoadPromise = null;
let installedGamesCache = []; // Backs the Update view (games with an installed appmanifest_*.acf)
let dlcGamesCache = [];        // Backs the DLC Adder (all Steam-installed games)

let activeAppIdCopyTimeout = null;

let isUserCurrentlyPremium = false; // Global flag for premium status
let currentUserStatus = 'free';     // Membership status that drives the badge ('free' | 'premium' | 'trial')
const GUEST_AUTH_CODE = 'fomiopalma';

async function updateTitleBarVersion() {
    if (!titleBarVersion) return;

    try {
        const version = await window.electronAPI.invoke('get-app-version');
        titleBarVersion.textContent = version || '';
    } catch (e) {
        titleBarVersion.textContent = '';
    }
}

// True only for paid/trial members. Uses userStatus (the same source as the FREE/PREMIUM
// badge) instead of the isPremium flag, which can be unreliable on older builds.
function isPremiumMember() {
    return currentUserStatus === 'premium' || currentUserStatus === 'trial';
}

function shouldPinFeaturedGamelistGames() {
    const hasSearch = !!(gamelistSearchView && gamelistSearchView.value.trim());
    const contentType = gamelistGameList ? (gamelistGameList.dataset.contentType || '') : '';
    return !isPremiumMember() &&
        activeGamelistCategory === GAMELIST_ALL_CATEGORY &&
        !hasSearch &&
        (!contentType || contentType === 'default-popular');
}

let isGamelistLoading = false; // Flag to prevent multiple concurrent loads
let isGamelistLoadingMore = false; // Flag for pagination-only loads
let gamelistNextStart = 0;         // Pagination cursor for infinite scroll
let gamelistHasMore = false;       // Whether more results are available
const gamelistSeenAppIds = new Set(); // Dedup across pages
const GAMELIST_PAGE_SIZE = 15;
const GAMELIST_ALL_CATEGORY = 'All';
const GAMELIST_POPULAR_CATEGORIES = [
    'Action',
    'Adventure',
    'Casual',
    'Indie',
    'RPG',
    'Racing',
    'Simulation',
    'Sports',
    'Strategy'
];
let activeGamelistCategory = GAMELIST_ALL_CATEGORY;
let activeGamelistSort = 'newest';
let activeGamelistPlayableFilter = 'all';
let gamelistLoadedGamesCache = [];


// --- NEW HELPER FUNCTION TO UPDATE MEMBERSHIP BADGE ---
function updateMembershipBadge(status, trialDays = 0) {
    if (!membershipBadge) return;
    membershipBadge.classList.remove('badge-free', 'badge-premium', 'badge-trial');
    if (status === 'premium') {
        membershipBadge.textContent = 'PREMIUM';
        membershipBadge.classList.add('badge-premium');
    } else if (status === 'trial') {
        membershipBadge.textContent = `TRIAL ${trialDays} DAYS`;
        membershipBadge.classList.add('badge-trial');
    } else {
        membershipBadge.textContent = 'FREE';
        membershipBadge.classList.add('badge-free');
    }
}

// --- NEW HELPER FUNCTION TO UPDATE BUTTONS DYNAMICALLY ---
function updateGamelistButtonsText() {
    const buttons = document.querySelectorAll('.gamelist-addsteam-btn');
    if (buttons.length === 0) return;

    const iconClass = 'fab fa-steam';
    const btnText = 'Add to Steam';

    buttons.forEach(btn => {
        // Only change text if it's not currently showing the spinning loading icon, status flash, or temporary downloaded indicator
        if (!btn.disabled && !btn.innerHTML.includes('fa-spinner') && !btn.classList.contains('success-flash') && !btn.classList.contains('error-flash') && !btn.classList.contains('downloaded')) {
            btn.classList.remove('downloaded');
            btn.innerHTML = `<i class="${iconClass}"></i> ${btnText}`;
        }
    });
}

// --- CUSTOM CONFIRM MODAL HELPER ---
function showCustomConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('customConfirmTitle');
        const messageEl = document.getElementById('customConfirmMessage');
        const cancelBtn = document.getElementById('customConfirmCancel');
        const proceedBtn = document.getElementById('customConfirmProceed');

        titleEl.textContent = title;
        messageEl.textContent = message;
        proceedBtn.textContent = options.confirmText || 'Proceed';
        proceedBtn.classList.toggle('danger-confirm', options.danger === true);

        if (options.hideCancel === true) {
            cancelBtn.style.display = 'none';
        } else {
            cancelBtn.style.display = 'block';
        }

        modal.style.display = 'flex';

        const cleanup = () => {
            cancelBtn.removeEventListener('click', onCancel);
            proceedBtn.removeEventListener('click', onProceed);
            // Reset shared modal back to its default look for other callers.
            proceedBtn.classList.remove('danger-confirm');
            proceedBtn.textContent = 'Proceed';
            cancelBtn.style.display = 'block';
            modal.style.display = 'none';
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onProceed = () => { cleanup(); resolve(true); };

        cancelBtn.addEventListener('click', onCancel);
        proceedBtn.addEventListener('click', onProceed);
    });
}

window.electronAPI.on('show-themed-message', ({ title, message, type } = {}) => {
    showCustomConfirm(title || 'Message', message || '', {
        confirmText: 'OK',
        hideCancel: true,
        danger: type === 'error'
    });
});

function switchToLogs() {
    if (logsView && menuLogsButton) {
        switchView(logsView, menuLogsButton);
    }
}
function addLog(message, type = 'info') {
    if (!statusArea) { console.warn("addLog: Status log area not found."); return; }
    if (type === 'progress') {
        if (lastProgressMessageElement?.parentNode === statusArea) {
            const msgSpan = lastProgressMessageElement.querySelector('.log-message'); if (msgSpan) msgSpan.textContent = message;
            const timeSpan = lastProgressMessageElement.querySelector('.log-timestamp');
            if (timeSpan) { const d=new Date();let h=d.getHours();const m=d.getMinutes().toString().padStart(2,'0');const s=d.getSeconds().toString().padStart(2,'0');const ap=h>=12?'PM':'AM';h=h%12;h=h?h:12;timeSpan.textContent=`[${h.toString().padStart(2,'0')}:${m}:${s} ${ap}]`;}
            statusArea.scrollTop = statusArea.scrollHeight; return;
        }
    } else { lastProgressMessageElement = null; }
    const logEntry = document.createElement('div'); logEntry.classList.add('log-entry', type);
    const timestampSpan = document.createElement('span'); timestampSpan.className = 'log-timestamp'; const d=new Date();let h=d.getHours();const m=d.getMinutes().toString().padStart(2,'0');const s=d.getSeconds().toString().padStart(2,'0');const ap=h>=12?'PM':'AM';h=h%12;h=h?h:12;timestampSpan.textContent=`[${h.toString().padStart(2,'0')}:${m}:${s} ${ap}]`;
    const messageSpan = document.createElement('span'); messageSpan.className = 'log-message'; messageSpan.textContent = message;
    logEntry.appendChild(timestampSpan); logEntry.appendChild(messageSpan); statusArea.appendChild(logEntry);
    if (type === 'progress') lastProgressMessageElement = logEntry;
    statusArea.scrollTop = statusArea.scrollHeight;
}

updateMembershipBadge('free');

if (processAppIdButton) {
    processAppIdButton.addEventListener('click', () => {
        switchToLogs();
        lastProgressMessageElement = null; const steamId = appIdInput.value.trim();
        if (steamId && /^\d+$/.test(steamId)) {
            addLog(`Processing AppID: ${steamId}`, 'info');
            [processAppIdButton, deleteIdButton, steamActionButton, setSaveLocationButton, appIdInput].forEach(el => el && (el.disabled = true));
            window.electronAPI.send('process-appid', steamId, false);
        } else { addLog('Please enter a valid AppID (numbers only).', 'error'); }
    });
}

if (deleteIdButton) {
    deleteIdButton.addEventListener('click', async () => {
        lastProgressMessageElement = null; const steamId = appIdInput.value.trim();
        if (steamId && /^\d+$/.test(steamId)) {
            const confirmed = await showCustomConfirm('Delete Game',
                `Delete files for AppID ${steamId}?`,
                { confirmText: 'Delete', danger: true }
            );
            if (!confirmed) return;
            switchToLogs();
            [processAppIdButton, deleteIdButton, steamActionButton, setSaveLocationButton, appIdInput].forEach(el => el && (el.disabled = true));
            window.electronAPI.send('delete-appid-files', steamId, 'home-view-confirmed');
        } else { addLog('Invalid AppID for deletion. Please enter numbers only.', 'error'); }
    });
}

if (appIdInput) { appIdInput.addEventListener('keypress', (event) => { if (event.key === 'Enter' && processAppIdButton && !processAppIdButton.disabled) processAppIdButton.click(); });}

if (submitAuthButton) {
    submitAuthButton.addEventListener('click', () => {
        const code = authCodeInput.value.trim();

        if (authStatus) {
            authStatus.textContent = ''; authStatus.className = ''; authStatus.style.display = 'none';
            if (authStatusTimeout) { clearTimeout(authStatusTimeout); authStatusTimeout = null; }
        }

        if (code) {
            if (authFormElements) authFormElements.style.display = 'none';
            if (pageBottomRightButtonContainer) pageBottomRightButtonContainer.style.display = 'none';
            if (authInitialMessage) { authInitialMessage.textContent = 'Submitting code...'; authInitialMessage.style.display = 'block';}
            if (authLoader) authLoader.style.display = 'block';
            if (authReadme) authReadme.style.display = 'none';
            window.electronAPI.send('submit-auth-code', code);
        } else {
            if (authStatus) {
                authStatus.textContent = 'Authentication code cannot be empty.'; authStatus.className = 'error'; authStatus.style.display = 'block';
                authStatusTimeout = setTimeout(() => { if (authStatus) { authStatus.textContent = ''; authStatus.className = ''; authStatus.style.display = 'none';}}, 3000);
            }
        }
    });
}

async function applySteamFixAction() {
    const confirm = await showCustomConfirm("Steam Fix", "This will close Steam, download and apply a fix to your Steam folder, and restart Steam. Proceed?");
    if (!confirm) return;

    const buttons = [];
    if (steamFixButton) buttons.push(steamFixButton);
    if (steamFixFooterButton) buttons.push(steamFixFooterButton);

    buttons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    });

    let success = false;
    let errorMsg = "Failed to apply Steam Fix.";

    try {
        const result = await window.electronAPI.invoke('apply-steam-fix');
        if (result === true) {
            success = true;
        } else if (result && typeof result === 'object') {
            success = result.success === true;
            if (result.message) errorMsg = result.message;
        }
    } catch (err) {
        addLog("Error calling Steam Fix process.", "error");
        errorMsg = err.message || "Error calling Steam Fix process.";
    } finally {
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-wrench"></i> Steam Fix`;
        });
    }

    if (success) {
        await showCustomConfirm("Success", "Steam Fix applied successfully! Steam is restarting.", { confirmText: "OK", hideCancel: true });
    } else {
        await showCustomConfirm("Error", errorMsg, { confirmText: "OK", hideCancel: true, danger: true });
    }
}

if (steamFixButton) {
    steamFixButton.addEventListener('click', applySteamFixAction);
}
if (steamFixFooterButton) {
    steamFixFooterButton.addEventListener('click', applySteamFixAction);
}
if (vpnFooterButton) {
    vpnFooterButton.addEventListener('click', () => {
        window.electronAPI.send('open-external-url', 'https://install.urban-vpn.com/UrbanVPN.exe');
        addLog('VPN: Opening UrbanVPN installer in the default browser.', 'info');
    });
}

if (authCodeInput) { authCodeInput.addEventListener('keypress', (event) => { if (event.key === 'Enter' && submitAuthButton && !submitAuthButton.disabled) submitAuthButton.click(); });}

if (changeDeviceButton) {
    changeDeviceButton.addEventListener('click', () => {
        if (changeDeviceModal) changeDeviceModal.style.display = 'flex';
        if (changeDeviceAuthCodeInput) changeDeviceAuthCodeInput.value = '';
        if (changeDeviceStatus) {
            changeDeviceStatus.textContent = '';
            changeDeviceStatus.className = 'modal-status';
            changeDeviceStatus.style.display = 'none';
        }
        if (changeDeviceAuthCodeInput) changeDeviceAuthCodeInput.focus();
    });
}

if (closeChangeDeviceModalButton) {
    closeChangeDeviceModalButton.addEventListener('click', () => {
        if (changeDeviceModal) changeDeviceModal.style.display = 'none';
    });
}

if (changeDeviceModal) {
    changeDeviceModal.addEventListener('click', (event) => {
        if (event.target === changeDeviceModal) {
            changeDeviceModal.style.display = 'none';
        }
    });
}
if (temporaryFixContainer) temporaryFixContainer.style.display = 'block';
if (oldSteamButton) {
    oldSteamButton.addEventListener('click', async () => {
        // REPLACED window.confirm WITH showCustomConfirm
        const confirm = await showCustomConfirm("Install Steam 32-bit", "This will close Steam and replace files in your Steam folder to downgrade to 32-bit. Proceed?");
        if (!confirm) return;

        oldSteamButton.disabled = true;
        oldSteamButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        
        try {
            await window.electronAPI.invoke('apply-old-steam');
        } catch (err) {
            addLog("Error calling Old Steam process.", "error");
        } finally {
            oldSteamButton.disabled = false;
            oldSteamButton.innerHTML = `<i class="fas fa-history"></i> Install Steam 32bit`;
        }
    });
}

if (submitChangeDeviceButton) {
    submitChangeDeviceButton.addEventListener('click', async () => {
        const authCode = changeDeviceAuthCodeInput.value.trim();
        if (!authCode) {
            changeDeviceStatus.textContent = 'Authentication code cannot be empty.';
            changeDeviceStatus.className = 'modal-status error';
            changeDeviceStatus.style.display = 'block';
            return;
        }

        changeDeviceStatus.textContent = 'Processing request...';
        changeDeviceStatus.className = 'modal-status info';
        changeDeviceStatus.style.display = 'block';
        submitChangeDeviceButton.disabled = true;
        changeDeviceAuthCodeInput.disabled = true;

        try {
            const result = await window.electronAPI.invoke('request-device-change', authCode);
            changeDeviceStatus.textContent = result.message;
            changeDeviceStatus.className = `modal-status ${result.success ? 'success' : 'error'}`;
        } catch (error) {
            console.error("Error invoking device change request.");
            changeDeviceStatus.textContent = 'An unexpected error occurred. Please try again.';
            changeDeviceStatus.className = 'modal-status error';
        } finally {
            changeDeviceStatus.style.display = 'block';
            submitChangeDeviceButton.disabled = false;
            changeDeviceAuthCodeInput.disabled = false;
        }
    });
}

if (changeDeviceAuthCodeInput) {
    changeDeviceAuthCodeInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && submitChangeDeviceButton && !submitChangeDeviceButton.disabled) {
            submitChangeDeviceButton.click();
        }
    });
}


async function updateSteamButtonState() {
    if (!steamActionButton || steamActionButton.style.display === 'none') return;
    const iconElement = steamActionButton.querySelector('i'); if (!iconElement) return;
    try {
        steamActionButton.disabled = true;
        const { isRunning } = await window.electronAPI.invoke('check-steam-status');
        
        // --- START OF MODIFIED SECTION ---
        // Always use the Steam icon as requested
        iconElement.className = STEAM_ICON_CLASS; 
        
        // Store the actual state in a data attribute
        steamActionButton.dataset.isRunning = isRunning; 

        // Update the button's text based on the state
        if (isRunning) {
            if (steamActionButtonText) steamActionButtonText.textContent = ' Restart';
        } else {
            if (steamActionButtonText) steamActionButtonText.textContent = ' Start';
        }
        // --- END OF MODIFIED SECTION ---
        
        steamActionButton.disabled = false;
    } catch (error) {
        addLog(`Error checking game platform status.`, 'error');
        iconElement.className = ERROR_ICON_CLASS;
        if (steamActionButtonText) steamActionButtonText.textContent = ' Error';
        // Clear the state attribute on error
        delete steamActionButton.dataset.isRunning;
        steamActionButton.disabled = true;
    }
}

if (steamActionButton) {
    steamActionButton.addEventListener('click', async () => {
        const iconElement = steamActionButton.querySelector('i'); if (!iconElement) return;

        // --- START OF MODIFIED SECTION ---
        // Determine the action based on the data attribute, not the icon
        const isCurrentlyRunning = steamActionButton.dataset.isRunning === 'true';
        steamActionButton.disabled = true; 
        try {
            if (isCurrentlyRunning) {
                // If Steam was running, call the restart handler
                await window.electronAPI.invoke('restart-steam');
            } else {
                // If Steam was not running, call the start handler
                await window.electronAPI.invoke('start-steam');
            }
        // --- END OF MODIFIED SECTION ---
        } catch (error) { 
            addLog(`Error with game platform action.`, 'error'); 
        }
        // Wait 3 seconds to give Steam time to start/stop before checking its status again
        setTimeout(updateSteamButtonState, 3000); 
    });
}

function handlePremiumViewContent(viewElement, isPremium) {
    const isPremiumLockedView = [
        drmView, dlcView, libraryView, steamlessView, onlineView, updateView,
        productLibraryView, gameLibraryView, softwareLibraryView, websitesView,
        zonePlayView, retroPlayView, watchZoneView
    ].includes(viewElement);

    if (!isPremiumLockedView) {
        const actualContent = viewElement.querySelector('.view-actual-content');
        const lockMessage = viewElement.querySelector('.premium-lock-message');
        if (actualContent) actualContent.style.display = 'flex';
        if (lockMessage) lockMessage.style.display = 'none';
        if (viewElement === gamelistView && gamelistView.classList.contains('active-view')) {
            if (!gamelistSearchView.value.trim() && gamelistGameList.children.length === 0 && !isGamelistLoading) {
                fetchAndDisplayDefaultGamelist();
            } else if (gamelistGameList.children.length === 0 && !gamelistSearchView.value.trim() && !gamelistStatusMessage.textContent.startsWith("Loading")) {
                setGamelistStatus('Enter an AppID or Game Title to search.', 'info');
            }
        }
        return;
    }

    const actualContent = viewElement.querySelector('.view-actual-content');
    const lockMessage = viewElement.querySelector('.premium-lock-message');

    if (!actualContent || !lockMessage) { return; }

    if (isPremium) {
        actualContent.style.display = 'flex';
        lockMessage.style.display = 'none';

        // COMBINED LOGIC FOR LIBRARY AND ONLINE (both backed by the .lua library list)
        if ((viewElement === libraryView || viewElement === onlineView) && viewElement.classList.contains('active-view')) {
            if (libraryGamesCache.length === 0) {
                fetchAndDisplayLibraryGames();
            } else {
                const searchInput = viewElement === libraryView ? librarySearchView : document.getElementById('onlineSearchView');
                const renderFn = viewElement === libraryView ? renderLibraryGames : renderOnlineGames;
                const searchTerm = searchInput.value.toLowerCase();
                const filteredGames = libraryGamesCache.filter(game =>
                    game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
                );
                renderFn(filteredGames);
                updateLibraryStatusMessage(filteredGames, searchTerm);
            }
        } else if (viewElement === updateView && updateView.classList.contains('active-view')) {
            // Update view is backed by the installed appmanifest_*.acf files, not the .lua list.
            if (installedGamesCache.length === 0) {
                fetchAndDisplayUpdateGames();
            } else {
                const searchTerm = updateSearchView.value.toLowerCase();
                const filteredGames = installedGamesCache.filter(game =>
                    game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
                );
                renderUpdateGames(filteredGames);
                updateUpdateStatusMessage(filteredGames, searchTerm);
            }
        } else if (viewElement === dlcView && dlcView.classList.contains('active-view')) {
            fetchAndDisplayDlcGames();
        } else if (viewElement === steamlessView && steamlessView.classList.contains('active-view')) {
            fetchAndDisplaySteamlessGames();
        } else if (viewElement === gamelistView && gamelistView.classList.contains('active-view')) {
            if (!gamelistSearchView.value.trim() && gamelistGameList.children.length === 0 && !isGamelistLoading) {
                fetchAndDisplayDefaultGamelist();
            } else if (gamelistGameList.children.length === 0 && !gamelistSearchView.value.trim() && !gamelistStatusMessage.textContent.startsWith("Loading")) {
                setGamelistStatus('Enter an AppID or Game Title to search.', 'info');
            }
        }
    } else {
        actualContent.style.display = 'none';
        lockMessage.style.display = 'flex';
        if (viewElement === libraryView) setLibraryStatus('Library is a premium feature.', 'warning');
        if (viewElement === onlineView) { // Also set status for online view
            const onlineStatus = document.getElementById('onlineStatusMessage');
            if(onlineStatus) {
                onlineStatus.textContent = 'Online is a premium feature.';
                onlineStatus.className = 'list-status-message warning';
                onlineStatus.style.display = 'block';
            }
        }
        if (viewElement === gamelistView) setGamelistStatus('Game List is a premium feature.', 'warning');
    }
}

function switchView(activeView, activeButton) {
    document.querySelectorAll('.content-view').forEach(view => view.classList.remove('active-view'));
    document.querySelectorAll('.sidebar-menu-item').forEach(button => button.classList.remove('active-menu-item'));

    if (activeView) activeView.classList.add('active-view');
    if (activeButton) activeButton.classList.add('active-menu-item');
    if (contentAreaFooter) {
        const footerViews = new Set(['homeView', 'helpView', 'gamelistView', 'steamlessView', 'drmView', 'libraryView']);
        contentAreaFooter.style.display = activeView && footerViews.has(activeView.id) ? 'flex' : 'none';
    }

    handlePremiumViewContent(activeView, isPremiumMember());
    if (window.youtubeMusicPage) window.youtubeMusicPage.setActive(!!activeView && activeView.id === 'youtubeMusicView');
    if (window.watchZoneApp && typeof window.watchZoneApp.setActive === 'function') {
        window.watchZoneApp.setActive(activeView === watchZoneView && isPremiumMember());
    }
    if (activeView === liveChatView) {
        markClientChatRead();
    }
}


if (menuHomeButton && homeView) { menuHomeButton.addEventListener('click', () => switchView(homeView, menuHomeButton)); }
if (menuGamelistButton && gamelistView) { menuGamelistButton.addEventListener('click', () => switchView(gamelistView, menuGamelistButton)); }
if (menuLibraryButton && libraryView) { menuLibraryButton.addEventListener('click', () => switchView(libraryView, menuLibraryButton)); }
if (menuSteamlessButton && steamlessView) { menuSteamlessButton.addEventListener('click', () => switchView(steamlessView, menuSteamlessButton)); }
if (menuUpdateButton && updateView) { menuUpdateButton.addEventListener('click', () => switchView(updateView, menuUpdateButton)); }
if (menuOnlineButton && onlineView) { menuOnlineButton.addEventListener('click', () => switchView(onlineView, menuOnlineButton)); }
if (menuSettingsButton && settingsView) { menuSettingsButton.addEventListener('click', () => switchView(settingsView, menuSettingsButton)); }
if (menuLogsButton && logsView) { menuLogsButton.addEventListener('click', () => switchView(logsView, menuLogsButton)); }

if (menuLogoutButton) {
    menuLogoutButton.addEventListener('click', () => {
        window.electronAPI.send('user-logout');
    });
}

function setPremiumUI(isPremium) {
    const buttonDisplayStyle = 'flex';
    const containerDisplayStyle = 'block';

    // 1. Update Version Status Indicator (Top Left)
    if (versionStatusIndicator) {
        if (isPremium) {
            versionStatusIndicator.textContent = 'PREMIUM';
            versionStatusIndicator.className = 'version-status-indicator premium';
        } else {
            versionStatusIndicator.textContent = 'FREE';
            versionStatusIndicator.className = 'version-status-indicator free';
        }
    }

    // 2. Sidebar Menu Buttons Logic
    const freeButtonIds = ['menuHomeButton', 'menuHelpButton', 'menuGamelistButton', 'menuDrmButton', 'menuMarketplaceButton', 'menuContactButton', 'menuLiveChatButton', 'menuWatchZoneButton', 'menuYouTubeMusicButton'];
    freeButtonIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = buttonDisplayStyle;
    });
    const premiumButtonIds = [
        { id: 'menuProductButton', icon: 'fas fa-box-open', text: 'Product Library' },
        { id: 'menuGameLibButton', icon: 'fas fa-gamepad', text: 'Switch Games' },
        { id: 'menuSoftwareButton', icon: 'fas fa-cube', text: 'Software Library' },
        { id: 'menuWebsitesButton', icon: 'fas fa-globe', text: 'Discover' },
        { id: 'menuSteamlessButton', icon: 'fas fa-link', text: 'Patch Hub' },
        { id: 'menuUpdateButton', icon: 'fas fa-sync', text: 'Updates' },
        { id: 'menuOnlineButton', icon: 'fas fa-globe', text: 'Online' },
        { id: 'menuZonePlayButton', icon: 'fas fa-play', text: 'Zone Play' },
        { id: 'menuRetroPlayButton', icon: 'fas fa-compact-disc', text: 'Retro Play' }
    ];
    premiumButtonIds.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.style.display = buttonDisplayStyle;
            el.innerHTML = `<i class="${item.icon}"></i> <span>${item.text}</span>`;
            el.classList.remove('locked-menu-item');
            el.style.cursor = 'pointer';
        }
    });

    // 3. Settings Sections - ALWAYS VISIBLE (Fixes the missing UI for Legacy)
    [autoPlaceToggleContainer, dlcToggleContainer, advancedSteamtoolsManagementContainer, unlockGameToggleContainer].forEach(el => {
        if (el) el.style.display = containerDisplayStyle;
    });

    // 4. Detailed Button and Toggle Logic
    if (!isPremium) {
        // --- NON-PREMIUM / LEGACY USERS ---
        // Toggles are visible but disabled (greyed out)
        if (dlcModeToggle) { dlcModeToggle.checked = false; dlcModeToggle.disabled = true; }

        // Disable specific Premium-only management buttons
        if (openSteamConfigButton) openSteamConfigButton.disabled = true;
        if (stopSteamButton) stopSteamButton.disabled = true;
        if (wipeSteamtoolsButton) wipeSteamtoolsButton.disabled = true;

        // ENABLE these for everyone
        [oldSteamButton, removeOldSteamButton, fixSteamtoolsButton].forEach(btn => {
        if (btn) btn.disabled = false;
    });
        
    } else {
        // --- PREMIUM USERS ---
        // Everything is enabled
        if (autoPlaceToggle) autoPlaceToggle.disabled = false;
        if (dlcModeToggle) dlcModeToggle.disabled = false;

        [openSteamConfigButton, wipeSteamtoolsButton, fixSteamtoolsButton, stopSteamButton, oldSteamButton, removeOldSteamButton].forEach(btn => {
        if (btn) btn.disabled = false;
    });
    }

    // 5. Handle content locking for Gamelist/Library/Online views
    const activeViewElement = document.querySelector('.content-view.active-view');
    if (activeViewElement) {
        handlePremiumViewContent(activeViewElement, isPremiumMember());
    }
}

if (oldSteamButton) {
    // Note: If you already have the longer oldSteamButton logic above, you can actually just delete this duplicate listener. 
    // If you want to keep it, change it like this:
    oldSteamButton.addEventListener('click', async () => {
        const confirm = await showCustomConfirm("Install Steam 32-bit", "This will close Steam and downgrade files. Proceed?");
        if (confirm) await window.electronAPI.invoke('apply-old-steam');
    });
}

if (removeOldSteamButton) {
    removeOldSteamButton.addEventListener('click', async () => {
        const confirm = await showCustomConfirm("Remove Steam 32-bit", "This will remove steam.cfg and allow Steam to update. Proceed?");
        if (confirm) await window.electronAPI.invoke('remove-old-steam');
    });
}

if (mainAppSection) {
    // =========================================================================
    // NEW DRAG AND DROP ZONE LOGIC
    // =========================================================================
    async function handleDroppedOrSelectedFiles(files) {
        const filesToSend = [];

        if (files?.length > 0) {
            switchToLogs(); // Auto-switch to Logs view
            addLog(`Processing ${files.length} item(s)...`, 'info');

            for (const file of files) {
                const lowerName = file.name.toLowerCase();
                let fileData = { name: file.name };

                // Only process valid file types
                if (lowerName.endsWith('.lua') || lowerName.endsWith('.manifest') || lowerName.endsWith('.zip')) {
                    try {
                        fileData.buffer = await file.arrayBuffer();
                        filesToSend.push(fileData);
                    } catch (bufferError) {
                        if (typeof file.path === 'string' && file.path.length > 0) {
                            fileData.path = file.path;
                            delete fileData.buffer;
                            filesToSend.push(fileData);
                            addLog(`Content read for ${file.name} failed. Sending path reference instead.`, 'warning');
                        } else {
                            addLog(`Drop Error: Cannot process ${file.name}.`, 'error');
                        }
                    }
                }
            }

            if (filesToSend.length > 0) {
                addLog(`Sending ${filesToSend.length} relevant file(s) for placement.`, 'info');
                window.electronAPI.send('handle-dropped-file-data', filesToSend);
            } else {
                addLog('No relevant files (.lua, .manifest, .zip) found to process.', 'warning');
            }
        } else {
            addLog('No files were provided.', 'info');
        }
    }

    if (dragDropArea) {
        dragDropArea.addEventListener('dragover', (event) => {
            event.preventDefault(); 
            event.stopPropagation();
            dragDropArea.classList.add('drag-over-active');
        });

        dragDropArea.addEventListener('dragleave', (event) => {
            event.preventDefault(); 
            event.stopPropagation();
            dragDropArea.classList.remove('drag-over-active');
        });

        dragDropArea.addEventListener('drop', (event) => {
            event.preventDefault(); 
            event.stopPropagation();
            dragDropArea.classList.remove('drag-over-active');
            handleDroppedOrSelectedFiles(event.dataTransfer.files);
        });

        // Clicking anywhere in the drag zone triggers the hidden file browser
        dragDropArea.addEventListener('click', (event) => {
            if (event.target !== fileInputHidden) {
                fileInputHidden.click();
            }
        });
    }

    // Handle the file input selection (Browse Files)
    if (fileInputHidden) {
        fileInputHidden.addEventListener('change', (event) => {
            handleDroppedOrSelectedFiles(event.target.files);
            fileInputHidden.value = ''; // Reset the value
        });
    }
}

if (setSaveLocationButton) {
    setSaveLocationButton.addEventListener('click', async () => {
        addLog('Opening dialog to select save location...', 'info'); setSaveLocationButton.disabled = true;
        try {
            await window.electronAPI.invoke('select-download-location');
        }
        catch (error) { addLog(`Error trying to set save location.`, 'error');}
        finally { setSaveLocationButton.disabled = false; }
    });
}

if (autoPlaceToggle) { 
    autoPlaceToggle.addEventListener('change', () => {
        window.electronAPI.send('set-auto-save-state', autoPlaceToggle.checked);
        updateGamelistButtonsText(); // Update the text instantly
    }); 
}
if (dlcModeToggle) { dlcModeToggle.addEventListener('change', () => window.electronAPI.send('set-dlc-mode-state', dlcModeToggle.checked)); }
if (unlockGameToggle) {
    unlockGameToggle.addEventListener('change', () => {
        window.electronAPI.send('set-unlock-game-state', unlockGameToggle.checked);
    });
}


if (openSteamConfigButton) {
    openSteamConfigButton.addEventListener('click', (e) => {
        e.preventDefault();
        addLog('Requesting to open game platform config folder...', 'info');
        window.electronAPI.send('open-steam-config-folder');
    });
}
if (wipeSteamtoolsButton) {
    wipeSteamtoolsButton.addEventListener('click', async () => {
        const confirmed = await showCustomConfirm(
            'Confirm Wipe Data',
            'Are you sure you want to wipe game platform data?\n\nThis will delete associated files. This action cannot be undone.',
            { confirmText: 'Wipe Data', danger: true }
        );
        if (!confirmed) return;
        window.electronAPI.send('wipe-steamtools-data');
    });
}
if (fixSteamtoolsButton) {
    fixSteamtoolsButton.addEventListener('click', () => {
        window.electronAPI.send('fix-steamtools');
    });
}

async function stopSteamAction(button) {
    addLog('Requesting to stop game platform process...', 'info');
    if (button) {
        button.disabled = true;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Stopping...`;
    }
    try {
        await window.electronAPI.invoke('stop-steam');
    } catch (error) {
        addLog(`Error stopping game platform.`, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="fas fa-stop-circle"></i> Stop Steam`;
        }
        setTimeout(updateSteamButtonState, 1500);
    }
}

if (stopSteamButton) {
    stopSteamButton.addEventListener('click', () => stopSteamAction(stopSteamButton));
}
if (stopSteamFooterButton) {
    stopSteamFooterButton.addEventListener('click', () => stopSteamAction(stopSteamFooterButton));
}


function setDlcStatus(message, type = 'info') {
    if (dlcStatusMessage) {
        dlcStatusMessage.textContent = message;
        dlcStatusMessage.className = `list-status-message ${type}`;
        dlcStatusMessage.style.display = message ? 'block' : 'none';
    }
}

function updateDlcStatusMessage(filtered, term) {
    if (dlcGamesCache.length === 0 && !term) {
        setDlcStatus('No installed games found. Try refreshing.', 'info');
    } else if (dlcGamesCache.length > 0 && filtered.length === 0 && term) {
        setDlcStatus(`No games found matching "${term}".`, 'info');
    } else {
        setDlcStatus('', 'info');
    }
}

function renderDlcGames(gamesToRender) {
    if (!dlcGameList) return;
    dlcGameList.innerHTML = '';
    if (!isUserCurrentlyPremium || !gamesToRender || gamesToRender.length === 0) return;

    gamesToRender.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item dlc-game-item';
        item.dataset.appId = game.appId;

        const img = document.createElement('img');
        setGameImageWithFallback(img, game);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info dlc-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name dlc-game-name';
        nameP.textContent = game.name;

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid dlc-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(appIdP, game.appId); });

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdP);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions dlc-game-actions';

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'update-toggle';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.className = 'update-toggle-input';
        toggleInput.checked = !!game.dlcAdded;

        const track = document.createElement('span');
        track.className = 'update-toggle-track';
        track.innerHTML = '<span class="update-toggle-text on">ON</span>'
                        + '<span class="update-toggle-text off">OFF</span>'
                        + '<span class="update-toggle-thumb"></span>';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(track);

        toggleInput.addEventListener('change', () => {
            const adding = toggleInput.checked;
            const channel = adding ? 'add-all-dlcs-for-game' : 'remove-all-dlcs-for-game';
            toggleInput.disabled = true;
            activeDlcCardButtons = { toggle: toggleInput, prev: !adding, appId: String(game.appId), adding };
            addLog(`DLC Adder: Requesting to ${adding ? 'add' : 'remove'} all DLCs for AppID ${game.appId} (${game.name}).`, 'info');
            window.electronAPI.send(channel, String(game.appId));
        });

        actionsDiv.appendChild(toggleLabel);

        item.appendChild(img);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        dlcGameList.appendChild(item);
    });
}

if (continueGuestButton) {
    continueGuestButton.addEventListener('click', () => {
        if (authCodeInput) authCodeInput.value = GUEST_AUTH_CODE;
        if (submitAuthButton && !submitAuthButton.disabled) submitAuthButton.click();
    });
}

async function fetchAndDisplayDlcGames(forceRefresh = false) {
    if (!dlcGameList) return;
    if (!isUserCurrentlyPremium) { renderDlcGames([]); return; }

    const term = dlcSearchView ? dlcSearchView.value.toLowerCase() : '';
    if (!forceRefresh && dlcGamesCache.length > 0) {
        const filtered = dlcGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
        renderDlcGames(filtered);
        updateDlcStatusMessage(filtered, term);
        return;
    }

    setDlcStatus('Loading installed games...', 'info');
    dlcGameList.innerHTML = '';
    if (dlcRefreshButton) { dlcRefreshButton.disabled = true; dlcRefreshButton.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i> Refreshing...`; }
    if (dlcSearchView) dlcSearchView.disabled = true;

    try {
        const result = await window.electronAPI.invoke('get-steam-installed-games');
        if (result.success) {
            dlcGamesCache = result.games || [];
            const filtered = dlcGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
            renderDlcGames(filtered);
            updateDlcStatusMessage(filtered, term);
        } else {
            renderDlcGames([]);
            setDlcStatus(result.message || 'Failed to load installed games.', 'error');
        }
    } catch (e) {
        renderDlcGames([]);
        setDlcStatus('Failed to load installed games.', 'error');
    } finally {
        if (dlcRefreshButton) { dlcRefreshButton.disabled = false; dlcRefreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh'; }
        if (dlcSearchView) dlcSearchView.disabled = false;
    }
}

function filterDlcGames() {
    if (!isUserCurrentlyPremium) return;
    const term = dlcSearchView ? dlcSearchView.value.toLowerCase() : '';
    const filtered = dlcGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
    renderDlcGames(filtered);
    updateDlcStatusMessage(filtered, term);
}

if (dlcSearchView) {
    dlcSearchView.addEventListener('input', filterDlcGames);
    dlcSearchView.addEventListener('keypress', (e) => { if (e.key === 'Enter') filterDlcGames(); });
}
if (dlcSearchButton) dlcSearchButton.addEventListener('click', filterDlcGames);
if (dlcRefreshButton) dlcRefreshButton.addEventListener('click', () => fetchAndDisplayDlcGames(true));

function setSteamlessStatus(message, type = 'info') {
    if (steamlessStatusMessage) {
        steamlessStatusMessage.textContent = message;
        steamlessStatusMessage.className = `list-status-message ${type}`;
        steamlessStatusMessage.style.display = message ? 'block' : 'none';
    }
}

function updateSteamlessStatusMessage(filtered, term) {
    if (steamlessGamesCache.length === 0 && !term) {
        setSteamlessStatus('No installed games found. Try refreshing.', 'info');
    } else if (steamlessGamesCache.length > 0 && filtered.length === 0 && term) {
        setSteamlessStatus(`No games found matching "${term}".`, 'info');
    } else {
        setSteamlessStatus('', 'info');
    }
}

function renderSteamlessGames(gamesToRender) {
    if (!steamlessGameList) return;
    steamlessGameList.innerHTML = '';
    if (!isUserCurrentlyPremium || !gamesToRender || gamesToRender.length === 0) return;

    gamesToRender.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item steamless-game-item';
        item.dataset.appId = game.appId;

        const img = document.createElement('img');
        setGameImageWithFallback(img, game);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info steamless-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name steamless-game-name';
        nameP.textContent = game.name;

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid steamless-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(appIdP, game.appId); });

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdP);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions steamless-game-actions';

        if (game.steamlessDllEnabled) {
            const playButton = document.createElement('button');
            playButton.type = 'button';
            playButton.className = 'game-item-button update-btn steamless-play-button';
            playButton.innerHTML = '<i class="fas fa-play"></i> Play';
            playButton.addEventListener('click', async () => {
                playButton.disabled = true;
                playButton.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i> Play`;
                try {
                    const result = await window.electronAPI.invoke('steamless-launch-game', String(game.appId));
                    if (!result || !result.success) throw new Error('launch-failed');
                    addLog('Patch Hub: Game launched.', 'success');
                } catch (e) {
                    addLog('Patch Hub: Sorry, this game cannot be launched.', 'error');
                    await showCustomConfirm('Patch Hub', 'Sorry, this game cannot be launched.', { confirmText: 'OK', hideCancel: true, danger: true });
                } finally {
                    playButton.disabled = false;
                    playButton.innerHTML = '<i class="fas fa-play"></i> Play';
                }
            });
            actionsDiv.appendChild(playButton);
        }

        const dllToggleLabel = document.createElement('label');
        dllToggleLabel.className = 'update-toggle steamless-dll-toggle';

        const dllToggleInput = document.createElement('input');
        dllToggleInput.type = 'checkbox';
        dllToggleInput.className = 'update-toggle-input';
        dllToggleInput.checked = !!game.steamlessDllEnabled;
        dllToggleInput.disabled = false;

        const dllTrack = document.createElement('span');
        dllTrack.className = 'update-toggle-track';
        dllTrack.innerHTML = '<span class="update-toggle-text on">ON</span>'
                           + '<span class="update-toggle-text off">OFF</span>'
                           + '<span class="update-toggle-thumb"></span>';

        dllToggleLabel.appendChild(dllToggleInput);
        dllToggleLabel.appendChild(dllTrack);

        dllToggleInput.addEventListener('change', async () => {
            const enable = dllToggleInput.checked;
            const previous = !enable;
            dllToggleInput.disabled = true;
            setSteamlessStatus('', 'info');
            addLog(`Patch Hub: Turning ${enable ? 'ON' : 'OFF'} for AppID ${game.appId} (${game.name}).`, 'info');

            try {
                const result = await window.electronAPI.invoke('steamless-set-dll-state', String(game.appId), enable);
                if (!result || !result.success) {
                    throw new Error('patch-failed');
                }
                game.steamlessDllEnabled = !!result.enabled;
                game.steamlessDllFound = result.found !== false;
                dllToggleInput.checked = !!result.enabled;
                addLog(`Patch Hub: ${result.enabled ? 'Patch enabled.' : 'Patch disabled.'}`, result.enabled === enable ? 'success' : 'warning');
                if (enable && !result.enabled) {
                    await showCustomConfirm('Patch Hub', 'Sorry, this game cannot be patched.', { confirmText: 'OK', hideCancel: true, danger: true });
                }
                filterSteamlessGames();
            } catch (e) {
                dllToggleInput.checked = previous;
                addLog('Patch Hub: Sorry, this game cannot be patched.', 'error');
                await showCustomConfirm('Patch Hub', 'Sorry, this game cannot be patched.', { confirmText: 'OK', hideCancel: true, danger: true });
            } finally {
                dllToggleInput.disabled = false;
            }
        });

        actionsDiv.appendChild(dllToggleLabel);

        item.appendChild(img);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        steamlessGameList.appendChild(item);
    });
}

async function fetchAndDisplaySteamlessGames(forceRefresh = false) {
    if (!steamlessGameList) return;
    if (!isUserCurrentlyPremium) { renderSteamlessGames([]); return; }

    const term = steamlessSearchView ? steamlessSearchView.value.toLowerCase() : '';
    if (!forceRefresh && steamlessGamesCache.length > 0) {
        const filtered = steamlessGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
        renderSteamlessGames(filtered);
        updateSteamlessStatusMessage(filtered, term);
        return;
    }

    setSteamlessStatus('Loading installed games...', 'info');
    steamlessGameList.innerHTML = '';
    if (steamlessRefreshButton) { steamlessRefreshButton.disabled = true; steamlessRefreshButton.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i> Refreshing...`; }
    if (steamlessSearchView) steamlessSearchView.disabled = true;

    try {
        const result = await window.electronAPI.invoke('steamless-get-installed-games');
        if (result.success) {
            steamlessGamesCache = result.games || [];
            const filtered = steamlessGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
            renderSteamlessGames(filtered);
            updateSteamlessStatusMessage(filtered, term);
        } else {
            renderSteamlessGames([]);
            setSteamlessStatus(result.message || 'Failed to load installed games.', 'error');
            addLog(`Patch Hub: ${result.message || 'Failed to load installed games.'}`, 'error');
        }
    } catch (e) {
        const message = 'Failed to load installed games.';
        renderSteamlessGames([]);
        setSteamlessStatus(message, 'error');
        addLog(`Patch Hub: ${message}`, 'error');
    } finally {
        if (steamlessRefreshButton) { steamlessRefreshButton.disabled = false; steamlessRefreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh'; }
        if (steamlessSearchView) steamlessSearchView.disabled = false;
    }
}

function filterSteamlessGames() {
    if (!isUserCurrentlyPremium) return;
    const term = steamlessSearchView ? steamlessSearchView.value.toLowerCase() : '';
    const filtered = steamlessGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
    renderSteamlessGames(filtered);
    updateSteamlessStatusMessage(filtered, term);
}

if (steamlessSearchView) {
    steamlessSearchView.addEventListener('input', filterSteamlessGames);
    steamlessSearchView.addEventListener('keypress', (e) => { if (e.key === 'Enter') filterSteamlessGames(); });
}
if (steamlessSearchButton) steamlessSearchButton.addEventListener('click', filterSteamlessGames);
if (steamlessRefreshButton) steamlessRefreshButton.addEventListener('click', () => fetchAndDisplaySteamlessGames(true));

function setLibraryStatus(message, type = 'info') {
    if (libraryStatusMessage) {
        libraryStatusMessage.textContent = message;
        libraryStatusMessage.className = `list-status-message ${type}`;
        libraryStatusMessage.style.display = message ? 'block' : 'none';
    }
}

function updateLibraryStatusMessage(filteredGames, searchTerm) {
    if (libraryGamesCache.length === 0 && !searchTerm) {
        setLibraryStatus('No games in library. Try refreshing.', 'info');
    } else if (libraryGamesCache.length > 0 && filteredGames.length === 0 && searchTerm) {
        setLibraryStatus(`No games found matching "${searchTerm}".`, 'info');
    } else if (libraryGamesCache.length === 0 && searchTerm) {
        setLibraryStatus(`No games in library to search for "${searchTerm}". Refresh first.`, 'info');
    }
     else {
        setLibraryStatus('', 'info');
    }
}


function canDeleteLibraryGame(game) {
    return !game || game.hasLua !== false;
}

function canManageLibraryDlc(game) {
    return isPremiumMember() && !!game?.installed;
}

function canManageLibraryOnlineFix(game) {
    return isPremiumMember() && !!game?.installed;
}

function setLibraryDlcButtonState(game, dlcBtn) {
    const canManage = canManageLibraryDlc(game);
    const dlcAdded = !!game?.dlcAdded;
    dlcBtn.innerHTML = '<i class="fas fa-puzzle-piece"></i>';
    dlcBtn.dataset.action = dlcAdded && canManage ? 'disable' : 'enable';
    dlcBtn.disabled = !canManage;
    dlcBtn.classList.toggle('delete-btn', canManage && dlcAdded);
    dlcBtn.classList.toggle('update-btn', !canManage || !dlcAdded);
    dlcBtn.classList.toggle('active', canManage);
    dlcBtn.setAttribute('aria-label', dlcAdded && canManage ? 'Remove DLC' : 'Add DLC');
}

function setLibraryOnlineFixButtonState(game, onlineFixBtn) {
    const canManage = canManageLibraryOnlineFix(game);
    const applied = !!game?.onlineFixApplied;
    onlineFixBtn.innerHTML = '<i class="fas fa-rocket"></i>';
    onlineFixBtn.dataset.action = applied && canManage ? 'remove' : 'apply';
    onlineFixBtn.disabled = !canManage;
    onlineFixBtn.classList.toggle('delete-btn', canManage && applied);
    onlineFixBtn.classList.toggle('update-btn', !canManage || !applied);
    onlineFixBtn.classList.toggle('active', canManage);
    onlineFixBtn.setAttribute('aria-label', applied && canManage ? 'Remove Online-Fix' : 'Add Online-Fix');
}

function normalizeLibraryBypassAppId(game) {
    const appId = game?.appid || game?.app_id || game?.appId || game?.steam_appid || game?.AppID;
    return appId == null ? '' : String(appId).trim();
}

async function loadLibraryBypassGames(forceRefresh = false) {
    if (!forceRefresh && libraryBypassGamesCache.length > 0) return libraryBypassGamesCache;
    if (libraryBypassGamesLoadPromise && !forceRefresh) return libraryBypassGamesLoadPromise;

    libraryBypassGamesLoadPromise = window.electronAPI.invoke('gl-fetch-games')
        .then((res) => {
            if (!res || !res.success || !Array.isArray(res.data)) return [];
            libraryBypassGamesCache = res.data.filter((game) => normalizeLibraryBypassAppId(game) && game.download_url);
            return libraryBypassGamesCache;
        })
        .catch(() => [])
        .finally(() => { libraryBypassGamesLoadPromise = null; });

    return libraryBypassGamesLoadPromise;
}

function getLibraryBypassGame(game) {
    const appId = String(game?.appId || '').trim();
    if (!appId) return null;
    return libraryBypassGamesCache.find((bypassGame) => normalizeLibraryBypassAppId(bypassGame) === appId) || null;
}

function hasBypassForAppId(appId) {
    const key = String(appId || '').trim();
    if (!key) return false;
    return libraryBypassGamesCache.some((bypassGame) => normalizeLibraryBypassAppId(bypassGame) === key);
}

function shouldShowActivationBadge(game) {
    const status = String(game?.displayStatus || '').toLowerCase();
    return [
        'not_playable',
        'coming_soon',
        'store_invalid',
        'store_error',
        'api_error',
        'unknown',
        'unknown_error'
    ].includes(status);
}

function createLibraryInstallStateButton(game) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `library-install-state ${game.installed ? 'installed' : 'not-installed'}`;
    button.innerHTML = game.installed
        ? '<i class="fab fa-steam"></i><span>UNINSTALL</span>'
        : '<i class="fab fa-steam"></i><span>INSTALL</span>';

    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        button.disabled = true;
        const originalHtml = button.innerHTML;
        button.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
        const channel = game.installed ? 'uninstall-steam-game' : 'install-steam-game';
        const action = game.installed ? 'uninstall' : 'install';

        try {
            const result = await window.electronAPI.invoke(channel, String(game.appId));
            if (!result || !result.success) throw new Error(result?.message || `${action}-open-failed`);
            addLog(`Steam Library: Opening Steam ${action} prompt for AppID ${game.appId}.`, 'info');
        } catch (err) {
            addLog(`Steam Library: Could not open Steam ${action} prompt for AppID ${game.appId}.`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    });

    return button;
}

function createLibraryPlayButton(game) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-play-state';
    button.innerHTML = '<i class="fas fa-play"></i><span>PLAY</span>';

    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        button.disabled = true;
        const originalHtml = button.innerHTML;
        button.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;

        try {
            const result = await window.electronAPI.invoke('launch-steam-game', String(game.appId));
            if (!result || !result.success) throw new Error(result?.message || 'launch-open-failed');
            addLog(`Steam Library: Opening Steam play prompt for AppID ${game.appId}.`, 'info');
        } catch (err) {
            addLog(`Steam Library: Could not open Steam play prompt for AppID ${game.appId}.`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    });

    return button;
}

function updateCachedDlcState(appId, added) {
    const key = String(appId);
    [dlcGamesCache, libraryGamesCache].forEach(cache => {
        const cached = cache.find(g => String(g.appId) === key);
        if (cached) cached.dlcAdded = !!added;
    });
}

function updateCachedOnlineFixState(appId, applied) {
    const key = String(appId);
    [onlineGamesCache, libraryGamesCache].forEach(cache => {
        const cached = cache.find(g => String(g.appId) === key);
        if (cached) cached.onlineFixApplied = !!applied;
    });
}

function updateLibraryDlcButtonsForApp(appId) {
    const key = String(appId);
    const game = libraryGamesCache.find(g => String(g.appId) === key);
    const item = document.querySelector(`#libraryGameList .game-item[data-app-id="${key}"]`);
    if (!item || !game) return;
    const dlcBtn = item.querySelector('.library-dlc-button');
    if (dlcBtn) setLibraryDlcButtonState(game, dlcBtn);
}

// Sets a game thumbnail from the predictable CDN url, and if that 404s (common
// for brand-new releases whose art lives under an unpredictable hash path) asks
// the API once for the real header image before giving up to the placeholder.
function setGameImageWithFallback(img, game) {
    img.src = game.imageUrl || GAME_IMAGE_PLACEHOLDER;
    img.onerror = () => {
        img.onerror = () => { img.src = GAME_IMAGE_PLACEHOLDER; }; // stop further retries
        window.electronAPI.invoke('get-game-image', game.appId)
            .then(res => {
                if (res && res.imageUrl) {
                    game.imageUrl = res.imageUrl; // cache on the object for re-renders this session
                    img.src = res.imageUrl;
                } else {
                    img.src = GAME_IMAGE_PLACEHOLDER;
                }
            })
            .catch(() => { img.src = GAME_IMAGE_PLACEHOLDER; });
    };
}

function renderLibraryGames(gamesToRender) {
    if (!libraryGameList) return;
    libraryGameList.innerHTML = '';

    if (gamesToRender.length === 0) {
        return;
    }

    gamesToRender.forEach(game => {
        const canDeleteGame = canDeleteLibraryGame(game);
        const item = document.createElement('div');
        item.className = 'game-item library-game-item';
        item.dataset.appId = game.appId;
        if (librarySelectMode) item.classList.add('library-select-session');

        if (librarySelectMode && canDeleteGame) {
            const appIdKey = String(game.appId);
            item.classList.add('selectable');
            if (librarySelectedAppIds.has(appIdKey)) item.classList.add('selected');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'library-select-checkbox';
            checkbox.checked = librarySelectedAppIds.has(appIdKey);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLibrarySelection(game.appId, item, checkbox);
            });
            // Clicking anywhere on the card (outside its buttons/appid) toggles selection.
            item.addEventListener('click', () => toggleLibrarySelection(game.appId, item, checkbox));
            item.appendChild(checkbox);
        }

        const img = document.createElement('img');
        setGameImageWithFallback(img, game);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info library-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name library-game-name';
        nameP.textContent = game.name;

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid library-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => {
            e.stopPropagation(); copyToClipboard(appIdP, game.appId);
        });

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdP);

        const installActions = document.createElement('div');
        installActions.className = 'library-install-actions';
        installActions.appendChild(createLibraryInstallStateButton(game));
        if (game.installed) installActions.appendChild(createLibraryPlayButton(game));
        infoDiv.appendChild(installActions);

        if (game.error) {
            const errorP = document.createElement('p');
            errorP.className = 'game-item-error';
            errorP.textContent = `Note: ${game.error}`;
            infoDiv.appendChild(errorP);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions library-game-actions';

        const bypassGame = getLibraryBypassGame(game);
        if (bypassGame) {
            const bypassBtn = document.createElement('button');
            bypassBtn.type = 'button';
            bypassBtn.className = 'game-item-button update-btn library-bypass-button active';
            bypassBtn.innerHTML = '<i class="fas fa-bolt"></i>';
            bypassBtn.disabled = !isPremiumMember();
            bypassBtn.setAttribute('aria-label', 'Open bypass patch options');
            bypassBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (bypassBtn.disabled) return;
                if (!window.GZGameLibraryPatchModal || typeof window.GZGameLibraryPatchModal.open !== 'function') {
                    addLog('Bypass: Patch modal is not available.', 'error');
                    return;
                }
                window.GZGameLibraryPatchModal.open(bypassGame, {
                    mode: 'bypass',
                    appId: game.appId,
                    installed: !!game.installed
                });
            });
            actionsDiv.appendChild(bypassBtn);
        }

        const onlineFixBtn = document.createElement('button');
        onlineFixBtn.type = 'button';
        onlineFixBtn.className = 'game-item-button update-btn library-online-button';

        const requestOnlineFixChange = async () => {
            if (!canManageLibraryOnlineFix(game)) return;
            const applying = !game.onlineFixApplied;
            onlineFixBtn.disabled = true;
            onlineFixBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            addLog(`Online-Fix: ${applying ? 'Applying' : 'Removing'} online fix for AppID ${game.appId} (${game.name}).`, 'info');

            try {
                const result = await window.electronAPI.invoke(applying ? 'online-fix-apply' : 'online-fix-remove', String(game.appId));
                game.onlineFixApplied = applying ? !!(result && result.success) : false;
                updateCachedOnlineFixState(game.appId, game.onlineFixApplied);
            } catch (err) {
                addLog(`Online-Fix: Error toggling AppID ${game.appId}.`, 'error');
            } finally {
                setLibraryOnlineFixButtonState(game, onlineFixBtn);
            }
        };

        onlineFixBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            requestOnlineFixChange();
        });

        setLibraryOnlineFixButtonState(game, onlineFixBtn);
        actionsDiv.appendChild(onlineFixBtn);

        const dlcBtn = document.createElement('button');
        dlcBtn.type = 'button';
        dlcBtn.className = 'game-item-button update-btn library-dlc-button';

        const requestDlcChange = () => {
            if (!canManageLibraryDlc(game)) return;
            const adding = !game.dlcAdded;
            const channel = adding ? 'add-all-dlcs-for-game' : 'remove-all-dlcs-for-game';
            dlcBtn.disabled = true;
            dlcBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            activeDlcCardButtons = {
                button: dlcBtn,
                appId: String(game.appId),
                adding
            };
            addLog(`DLC: Requesting to ${adding ? 'enable' : 'disable'} DLCs for AppID ${game.appId} (${game.name}).`, 'info');
            window.electronAPI.send(channel, String(game.appId));
        };

        dlcBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            requestDlcChange();
        });

        setLibraryDlcButtonState(game, dlcBtn);
        actionsDiv.appendChild(dlcBtn);

        if (canDeleteGame) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'game-item-button delete-btn library-game-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await showCustomConfirm('Delete Game',
                    `Delete "${game.name}" (AppID ${game.appId}) from your library? This removes its .lua file.`,
                    { confirmText: 'Delete', danger: true });
                if (!confirmed) return;
                switchToLogs();
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
                try {
                    window.electronAPI.send('delete-appid-files', game.appId, 'library-view');
                } catch (err) {
                    addLog(`Library: Error during delete request for ${game.name}.`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                } finally {
                     setTimeout(() => fetchAndDisplayLibraryGames(true), 1200);
                }
            });

            actionsDiv.appendChild(deleteBtn);
        } else {
            const deleteSpacer = document.createElement('span');
            deleteSpacer.className = 'library-delete-spacer';
            deleteSpacer.setAttribute('aria-hidden', 'true');
            actionsDiv.appendChild(deleteSpacer);
        }

        item.appendChild(img);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        libraryGameList.appendChild(item);
    });
}

function setUpdateStatus(message, type = 'info') {
    if (updateStatusMessage) {
        updateStatusMessage.textContent = message;
        updateStatusMessage.className = `list-status-message ${type}`;
        updateStatusMessage.style.display = message ? 'block' : 'none';
    }
}

function updateUpdateStatusMessage(filteredGames, searchTerm) {
    if (installedGamesCache.length === 0 && !searchTerm) {
        setUpdateStatus('No installed games found. Try refreshing.', 'info');
    } else if (installedGamesCache.length > 0 && filteredGames.length === 0 && searchTerm) {
        setUpdateStatus(`No games found matching "${searchTerm}".`, 'info');
    } else {
        setUpdateStatus('', 'info');
    }
}

async function fetchAndDisplayUpdateGames(forceRefresh = false) {
    if (!updateGameList) return;
    if (!isUserCurrentlyPremium) { renderUpdateGames([]); return; }

    const currentSearchTerm = updateSearchView ? updateSearchView.value.toLowerCase() : '';
    if (!forceRefresh && installedGamesCache.length > 0) {
        const filteredGames = installedGamesCache.filter(g => g.name.toLowerCase().includes(currentSearchTerm) || g.appId.includes(currentSearchTerm));
        renderUpdateGames(filteredGames);
        updateUpdateStatusMessage(filteredGames, currentSearchTerm);
        return;
    }

    setUpdateStatus('Loading installed games...', 'info');
    updateGameList.innerHTML = '';
    if (updateRefreshButton) { updateRefreshButton.disabled = true; updateRefreshButton.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i> Refreshing...`; }
    if (updateSearchView) updateSearchView.disabled = true;

    try {
        const result = await window.electronAPI.invoke('get-installed-games');
        if (result.success) {
            installedGamesCache = result.games || [];
            const filteredGames = installedGamesCache.filter(g => g.name.toLowerCase().includes(currentSearchTerm) || g.appId.includes(currentSearchTerm));
            renderUpdateGames(filteredGames);
            updateUpdateStatusMessage(filteredGames, currentSearchTerm);
        } else {
            installedGamesCache = [];
            renderUpdateGames([]);
            setUpdateStatus(result.message || 'Failed to load installed games.', 'error');
        }
    } catch (error) {
        installedGamesCache = [];
        renderUpdateGames([]);
        setUpdateStatus('Error fetching installed games.', 'error');
        addLog('Update list fetch error.', 'error');
    } finally {
        if (updateRefreshButton) { updateRefreshButton.disabled = false; updateRefreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh'; }
        if (updateSearchView) updateSearchView.disabled = false;
        if (updateView.classList.contains('active-view') && updateSearchView) updateSearchView.focus();
    }
}

function renderUpdateGames(gamesToRender) {
    if (!updateGameList) return;
    updateGameList.innerHTML = '';

    if (!isUserCurrentlyPremium || gamesToRender.length === 0) {
        return;
    }

    gamesToRender.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item update-game-item';
        item.dataset.appId = game.appId;

        const img = document.createElement('img');
        img.src = game.imageUrl || GAME_IMAGE_PLACEHOLDER;
        img.onerror = () => { img.src = GAME_IMAGE_PLACEHOLDER; };

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info update-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name update-game-name';
        nameP.textContent = game.name;

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid update-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(appIdP, game.appId); });

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdP);

        if (game.error) {
            const errorP = document.createElement('p');
            errorP.className = 'game-item-error';
            errorP.textContent = `Note: ${game.error}`;
            infoDiv.appendChild(errorP);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions update-game-actions';

        const updateBtn = document.createElement('button');
        updateBtn.className = 'game-item-button update-btn update-game-update-btn';
        updateBtn.textContent = 'UPDATE';
        updateBtn.style.fontWeight = '700';
        updateBtn.style.fontSize = '10px';

        const disableBtn = document.createElement('button');
        disableBtn.className = 'game-item-button disable-btn update-game-disable-btn';
        disableBtn.textContent = 'DISABLE';
        disableBtn.style.fontWeight = '700';
        disableBtn.style.fontSize = '10px';

        // UPDATE: existing manifest-update flow (also clears the manifest read-only lock in main.js)
        updateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchToLogs();
            updateBtn.disabled = true; disableBtn.disabled = true;
            updateBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            window.electronAPI.send('process-library-item-update', game.appId);
        });

        // DISABLE: find appmanifest_<appid>.acf across all steamapps libraries and set it read-only
        disableBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            switchToLogs();
            updateBtn.disabled = true; disableBtn.disabled = true;
            disableBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            try {
                const result = await window.electronAPI.invoke('disable-appid-manifest', game.appId);
                disableBtn.classList.remove('success-flash', 'error-flash');
                disableBtn.classList.add(result && result.success ? 'success-flash' : 'error-flash');
                setTimeout(() => disableBtn.classList.remove('success-flash', 'error-flash'), 1500);
            } catch (err) {
                addLog(`Update: Error disabling AppID ${game.appId}.`, 'error');
                disableBtn.classList.add('error-flash');
                setTimeout(() => disableBtn.classList.remove('error-flash'), 1500);
            } finally {
                disableBtn.innerHTML = 'DISABLE';
                updateBtn.disabled = false; disableBtn.disabled = false;
            }
        });

        actionsDiv.appendChild(updateBtn);
        actionsDiv.appendChild(disableBtn);

        item.appendChild(img);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        updateGameList.appendChild(item);
    });
}


// --- Library multi-select / bulk delete ------------------------------------
let librarySelectMode = false;
const librarySelectedAppIds = new Set();

function getFilteredLibraryGames() {
    const term = (librarySearchView && librarySearchView.value || '').toLowerCase();
    return libraryGamesCache.filter(g => g.name.toLowerCase().includes(term) || g.appId.includes(term));
}

function updateLibraryBulkBar() {
    const bar = document.getElementById('libraryBulkBar');
    const delBtn = document.getElementById('libraryDeleteSelectedButton');
    const selectToggle = document.getElementById('librarySelectToggleButton');
    if (bar) bar.style.display = librarySelectMode ? 'flex' : 'none';
    if (selectToggle) selectToggle.style.display = librarySelectMode ? 'none' : '';
    if (delBtn) {
        const n = librarySelectedAppIds.size;
        delBtn.disabled = n === 0;
        delBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Delete Selected (${n})`;
    }
}

function setLibrarySelectMode(on) {
    librarySelectMode = on;
    if (!on) librarySelectedAppIds.clear();
    updateLibraryBulkBar();
    renderLibraryGames(getFilteredLibraryGames());
}

function toggleLibrarySelection(appId, itemEl, checkboxEl) {
    const key = String(appId);
    if (librarySelectedAppIds.has(key)) librarySelectedAppIds.delete(key);
    else librarySelectedAppIds.add(key);
    const selected = librarySelectedAppIds.has(key);
    if (itemEl) itemEl.classList.toggle('selected', selected);
    if (checkboxEl) checkboxEl.checked = selected;
    updateLibraryBulkBar();
}

const librarySelectToggleButton = document.getElementById('librarySelectToggleButton');
if (librarySelectToggleButton) {
    librarySelectToggleButton.addEventListener('click', () => setLibrarySelectMode(true));
}

const libraryCancelSelectButton = document.getElementById('libraryCancelSelectButton');
if (libraryCancelSelectButton) {
    libraryCancelSelectButton.addEventListener('click', () => setLibrarySelectMode(false));
}

const librarySelectAllButton = document.getElementById('librarySelectAllButton');
if (librarySelectAllButton) {
    librarySelectAllButton.addEventListener('click', () => {
        const filtered = getFilteredLibraryGames();
        const selectable = filtered.filter(canDeleteLibraryGame);
        const allSelectableSelected = selectable.length > 0 && selectable.every(g => librarySelectedAppIds.has(String(g.appId)));
        selectable.forEach(g => {
            if (allSelectableSelected) librarySelectedAppIds.delete(String(g.appId));
            else librarySelectedAppIds.add(String(g.appId));
        });
        updateLibraryBulkBar();
        renderLibraryGames(filtered);
    });
}

const libraryDeleteSelectedButton = document.getElementById('libraryDeleteSelectedButton');
if (libraryDeleteSelectedButton) {
    libraryDeleteSelectedButton.addEventListener('click', async () => {
        const ids = Array.from(librarySelectedAppIds);
        if (ids.length === 0) return;
        const confirmed = await showCustomConfirm('Delete Selected Games',
            `Delete ${ids.length} selected game(s) from your library? This removes their .lua files.`,
            { confirmText: 'Delete', danger: true });
        if (!confirmed) return;
        switchToLogs();
        for (const appId of ids) {
            try {
                window.electronAPI.send('delete-appid-files', appId, 'library-view');
            } catch (err) {
                addLog(`Library: Error during bulk delete request for AppID ${appId}.`, 'error');
            }
        }
        addLog(`Library: Requested deletion of ${ids.length} selected game(s).`, 'info');
        setLibrarySelectMode(false);
        // Give the per-file deletes time to finish, then refresh the list once.
        setTimeout(() => fetchAndDisplayLibraryGames(true), 1200 + ids.length * 60);
    });
}

if (libraryRefreshButton) {
    libraryRefreshButton.addEventListener('click', () => fetchAndDisplayLibraryGames(true));
}

if (librarySearchView) {
    librarySearchView.addEventListener('input', () => {
        const searchTerm = librarySearchView.value.toLowerCase();
        const filteredGames = libraryGamesCache.filter(game =>
            game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
        );
        renderLibraryGames(filteredGames);
        updateLibraryStatusMessage(filteredGames, searchTerm);
    });
}
// When the Online refresh button is clicked, just refresh the main library.
if (document.getElementById('onlineRefreshButton')) {
document.getElementById('onlineRefreshButton').addEventListener('click', () => fetchAndDisplayLibraryGames(true));
}
// When typing in the Online search bar, filter the main library list.
if (document.getElementById('onlineSearchView')) {
    document.getElementById('onlineSearchView').addEventListener('input', () => {
        const searchTerm = document.getElementById('onlineSearchView').value.toLowerCase();
        const filteredGames = libraryGamesCache.filter(game =>
            game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
        );
        // CORRECTED: This now calls the correct function to render the Online list.
        renderOnlineGames(filteredGames.filter(canDeleteLibraryGame)); 
    });
}
function setOnlineStatus(message, type = 'info') {
    if (onlineStatusMessage) {
        onlineStatusMessage.textContent = message;
        onlineStatusMessage.className = `list-status-message ${type}`;
        onlineStatusMessage.style.display = message ? 'block' : 'none';
    }
}

function updateOnlineStatusMessage(filteredGames, searchTerm) {
    if (onlineGamesCache.length === 0 && !searchTerm) {
        setOnlineStatus('No popular games found. Try refreshing.', 'info');
    } else if (onlineGamesCache.length > 0 && filteredGames.length === 0 && searchTerm) {
        setOnlineStatus(`No games found matching "${searchTerm}".`, 'info');
    } else {
        setOnlineStatus('', 'info');
    }
}

function renderOnlineGames(gamesToRender) {
    const onlineGameList = document.getElementById('onlineGameList');
    if (!onlineGameList) return;
    onlineGameList.innerHTML = '';

    if (!isUserCurrentlyPremium || gamesToRender.length === 0) {
        return;
    }

    gamesToRender.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-item online-game-item';
        item.dataset.appId = game.appId;

        const img = document.createElement('img');
        setGameImageWithFallback(img, game);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info online-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name online-game-name';
        nameP.textContent = game.name;

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid online-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => { e.stopPropagation(); copyToClipboard(appIdP, game.appId); });

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdP);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions online-game-actions';

        const folderBtn = document.createElement('button');
        folderBtn.className = 'game-item-button save-location-button-yellow online-folder-btn';
        folderBtn.innerHTML = '<i class="fas fa-folder-open"></i>';

        const fixBtn = document.createElement('button');
        fixBtn.className = 'game-item-button update-btn online-fix-btn';
        fixBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'game-item-button online-remove-btn delete-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        
        const allButtons = [folderBtn, fixBtn, removeBtn];

        // MODIFIED BEHAVIOR: Always prompts to set/update the path.
        folderBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            addLog(`Online-Fix: Opening dialog to set/update game path for ${game.name}...`, 'info');
            // This single call will always open the dialog, allowing the user to
            // create a new path or modify an existing one.
            await window.electronAPI.invoke('online-fix-set-path', game.appId);
        });

        fixBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            switchToLogs();
            allButtons.forEach(btn => btn.disabled = true);
            fixBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            await window.electronAPI.invoke('online-fix-apply', game.appId);
            fixBtn.innerHTML = '<i class="fas fa-check"></i>';
            allButtons.forEach(btn => btn.disabled = false);
        });

        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            switchToLogs();
            allButtons.forEach(btn => btn.disabled = true);
            removeBtn.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i>`;
            await window.electronAPI.invoke('online-fix-remove', game.appId);
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            allButtons.forEach(btn => btn.disabled = false);
        });

        actionsDiv.appendChild(folderBtn);
        actionsDiv.appendChild(fixBtn);
        actionsDiv.appendChild(removeBtn);

        item.appendChild(img);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        onlineGameList.appendChild(item);
    });
}


async function fetchAndDisplayLibraryGames(forceRefresh = false) {
    if (!libraryGameList || !libraryStatusMessage) return;
    // Steam Library is open to all logged-in users; the main process enforces auth
    // on get-library-games. (Online view stays premium-gated by its own lock.)

    const currentSearchTerm = librarySearchView.value.toLowerCase();
    if (!forceRefresh && libraryGamesCache.length > 0) {
        await loadLibraryBypassGames(false);
        const filteredGames = libraryGamesCache.filter(game =>
            game.name.toLowerCase().includes(currentSearchTerm) || game.appId.includes(currentSearchTerm)
        );
        renderLibraryGames(filteredGames);
        renderOnlineGames(filteredGames.filter(canDeleteLibraryGame)); // Also render to the online list
        updateLibraryStatusMessage(filteredGames, currentSearchTerm);
        return;
    }

    setLibraryStatus('Loading library...', 'info');
    libraryGameList.innerHTML = '';
    document.getElementById('onlineGameList').innerHTML = ''; // Clear both lists
    libraryRefreshButton.disabled = true;
    libraryRefreshButton.innerHTML = `<i class="${PROCESSING_ICON_CLASS}"></i> Refreshing...`;
    librarySearchView.disabled = true;

    try {
        const result = await window.electronAPI.invoke('get-library-games');
        if (result.success) {
            libraryGamesCache = result.games || [];
            await loadLibraryBypassGames(forceRefresh);
            const filteredGames = libraryGamesCache.filter(g => g.name.toLowerCase().includes(currentSearchTerm) || g.appId.includes(currentSearchTerm));
            renderLibraryGames(filteredGames); // Render to library
            renderOnlineGames(filteredGames.filter(canDeleteLibraryGame));  // Render to online
            updateLibraryStatusMessage(filteredGames, currentSearchTerm);
        } else {
            libraryGamesCache = [];
            renderLibraryGames([]);
            renderOnlineGames([]);
            setLibraryStatus(result.message || 'Failed to load library.', 'error');
        }
    } catch (error) {
        libraryGamesCache = [];
        renderLibraryGames([]);
        renderOnlineGames([]);
        setLibraryStatus('Error fetching library data.', 'error');
        addLog(`Library Fetch Error.`, 'error');
    } finally {
        libraryRefreshButton.disabled = false;
        libraryRefreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        librarySearchView.disabled = false;
        if (libraryView.classList.contains('active-view')) librarySearchView.focus();
    }
}

if (updateRefreshButton) {
    updateRefreshButton.addEventListener('click', () => fetchAndDisplayUpdateGames(true));
}

if (updateSearchView) {
    updateSearchView.addEventListener('input', () => {
        const searchTerm = updateSearchView.value.toLowerCase();
        const filteredGames = installedGamesCache.filter(game =>
            game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
        );
        renderUpdateGames(filteredGames);
        updateUpdateStatusMessage(filteredGames, searchTerm);
    });
}

if (onlineRefreshButton) {
    onlineRefreshButton.addEventListener('click', () => fetchAndDisplayOnlineGames(true));
}

if (onlineSearchView) {
    onlineSearchView.addEventListener('input', () => {
        const searchTerm = onlineSearchView.value.toLowerCase();
        const filteredGames = onlineGamesCache.filter(game =>
            game.name.toLowerCase().includes(searchTerm) || game.appId.includes(searchTerm)
        );
        renderOnlineGames(filteredGames);
        updateOnlineStatusMessage(filteredGames, searchTerm);
    });
}

function setGamelistStatus(message, type = 'info') {
    if (gamelistStatusMessage) {
        gamelistStatusMessage.textContent = message;
        gamelistStatusMessage.className = `list-status-message ${type}`;
        if (!message || message.trim() === '') {
            gamelistStatusMessage.style.display = 'none';
        } else {
            gamelistStatusMessage.style.display = 'block';
        }
    }
}

function normalizeGamelistCategory(value) {
    if (value === null || value === undefined) return '';
    const text = String(value).trim().replace(/\s+/g, ' ');
    return text.length > 40 ? text.slice(0, 40).trim() : text;
}

function getGamelistCategories(game) {
    const rawCandidates = [
        game?.genres,
        game?.categories,
        game?.genre,
        game?.category,
        game?.tags
    ];
    const categories = [];

    rawCandidates.forEach(candidate => {
        if (!candidate) return;
        const values = Array.isArray(candidate) ? candidate : String(candidate).split(/[,;/|]/);
        values.forEach(value => {
            const normalized = normalizeGamelistCategory(
                value && typeof value === 'object' ? (value.description || value.name || value.label) : value
            );
            if (normalized && !categories.some(existing => existing.toLowerCase() === normalized.toLowerCase())) {
                categories.push(normalized);
            }
        });
    });

    return categories;
}

function getGamelistCardCategories(item) {
    if (!item || !item.dataset.categories) return [];
    try {
        const parsed = JSON.parse(item.dataset.categories);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function dedupeGamelistGames(games) {
    const seen = new Set();
    const deduped = [];

    (Array.isArray(games) ? games : []).forEach(game => {
        if (!game || !game.appId) return;
        const appIdKey = String(game.appId);
        if (seen.has(appIdKey)) return;
        seen.add(appIdKey);
        deduped.push(game);
    });

    return deduped;
}

function parseGamelistReleaseTimestamp(value) {
    if (!value || typeof value !== 'string') return 0;
    const normalized = value.trim();
    if (!normalized || /coming soon|tba|to be announced/i.test(normalized)) return 0;

    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) return parsed;

    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
        return Date.UTC(Number(yearMatch[0]), 0, 1);
    }

    return 0;
}

function getGamelistReleaseTimestamp(game) {
    if (!game) return 0;
    if (Number.isFinite(game.releaseTimestamp)) return game.releaseTimestamp;
    return parseGamelistReleaseTimestamp(game.releaseDate || game.release_date || game.release || '');
}

function matchesGamelistPlayableFilter(game) {
    if (activeGamelistPlayableFilter === 'all') return true;
    const status = String(game?.displayStatus || '').toLowerCase();
    if (activeGamelistPlayableFilter === 'playable') {
        return status === 'playable' || status === 'free_to_play';
    }
    if (activeGamelistPlayableFilter === 'not_playable') return status === 'not_playable';
    return true;
}

function hasActiveGamelistPlayableFilter() {
    return activeGamelistPlayableFilter !== 'all';
}

function getGamelistRenderedCount() {
    if (!gamelistGameList) return 0;
    return gamelistGameList.querySelectorAll('.gamelist-game-item').length;
}

function needsMoreGamelistRowsForScroll() {
    const mainArea = document.getElementById('mainContentArea');
    const scrollTargets = [gamelistGameList, mainArea].filter(Boolean);
    if (!scrollTargets.length) return false;
    return scrollTargets.every(target => (target.scrollHeight - target.clientHeight) <= 300);
}

function requestMoreGamelistFilteredResults() {
    if (!hasActiveGamelistPlayableFilter() || !gamelistHasMore || isGamelistLoading || isGamelistLoadingMore) return;
    if (getGamelistRenderedCount() > 0 && !needsMoreGamelistRowsForScroll()) return;
    requestAnimationFrame(() => loadMoreGamelist());
}

function getOrderedGamelistGames(games) {
    const sortGames = (items) => {
        const ordered = [...items];
        if (activeGamelistSort === 'newest') {
            ordered.sort((a, b) => {
                const dateDiff = getGamelistReleaseTimestamp(b) - getGamelistReleaseTimestamp(a);
                if (dateDiff !== 0) return dateDiff;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        } else if (activeGamelistSort === 'oldest') {
            ordered.sort((a, b) => {
                const dateA = getGamelistReleaseTimestamp(a);
                const dateB = getGamelistReleaseTimestamp(b);
                if (dateA === 0 && dateB !== 0) return 1;
                if (dateB === 0 && dateA !== 0) return -1;
                const dateDiff = dateA - dateB;
                if (dateDiff !== 0) return dateDiff;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        } else if (activeGamelistSort === 'az') {
            ordered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        } else if (activeGamelistSort === 'za') {
            ordered.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        }
        return ordered;
    };

    const filtered = dedupeGamelistGames(games).filter(matchesGamelistPlayableFilter);
    if (shouldPinFeaturedGamelistGames()) {
        const featured = [];
        const regular = [];
        filtered.forEach(game => {
            const appIdKey = String(game?.appId || '');
            if (game?.featured || featuredAppIdsSet.has(appIdKey)) featured.push(game);
            else regular.push(game);
        });
        return [...sortGames(featured), ...sortGames(regular)];
    }

    return sortGames(filtered);
}

function closeGamelistSortMenu() {
    if (!gamelistSortSelect || !gamelistSortButton) return;
    gamelistSortSelect.classList.remove('open');
    gamelistSortButton.setAttribute('aria-expanded', 'false');
}

function closeGamelistPlayableMenu() {
    if (!gamelistPlayableSelect || !gamelistPlayableButton) return;
    gamelistPlayableSelect.classList.remove('open');
    gamelistPlayableButton.setAttribute('aria-expanded', 'false');
}

function setGamelistSort(value) {
    const nextSort = ['newest', 'oldest', 'az', 'za'].includes(value) ? value : 'newest';
    activeGamelistSort = nextSort;
    if (gamelistSortSelect) gamelistSortSelect.dataset.value = nextSort;

    if (gamelistSortOptions) {
        gamelistSortOptions.querySelectorAll('.gamelist-sort-option').forEach(option => {
            const isActive = option.dataset.value === nextSort;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-selected', String(isActive));
            if (isActive && gamelistSortButtonText) {
                gamelistSortButtonText.textContent = option.textContent;
            }
        });
    }

    if (!gamelistLoadedGamesCache.length) return;
    const previousScrollTop = gamelistGameList ? gamelistGameList.scrollTop : 0;
    renderGamelistGames(gamelistLoadedGamesCache, { updateCache: false });
    if (gamelistGameList) gamelistGameList.scrollTop = previousScrollTop;
    requestMoreGamelistFilteredResults();
}

function setGamelistPlayableFilter(value) {
    const nextFilter = ['all', 'playable', 'not_playable'].includes(value) ? value : 'all';
    activeGamelistPlayableFilter = nextFilter;
    if (gamelistPlayableSelect) gamelistPlayableSelect.dataset.value = nextFilter;

    if (gamelistPlayableOptions) {
        gamelistPlayableOptions.querySelectorAll('.gamelist-playable-option').forEach(option => {
            const isActive = option.dataset.value === nextFilter;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-selected', String(isActive));
            if (isActive && gamelistPlayableButtonText) {
                gamelistPlayableButtonText.textContent = option.textContent;
            }
        });
    }

    if (!gamelistLoadedGamesCache.length) {
        requestMoreGamelistFilteredResults();
        return;
    }
    const previousScrollTop = gamelistGameList ? gamelistGameList.scrollTop : 0;
    renderGamelistGames(gamelistLoadedGamesCache, { updateCache: false });
    if (gamelistGameList) gamelistGameList.scrollTop = previousScrollTop;
    requestMoreGamelistFilteredResults();
}

function resetGamelistFiltersToDefault() {
    const previousContentType = gamelistGameList ? (gamelistGameList.dataset.contentType || '') : '';
    const hadSearch = !!(gamelistSearchView && gamelistSearchView.value.trim());

    closeGamelistSortMenu();
    closeGamelistPlayableMenu();
    if (gamelistSearchView) gamelistSearchView.value = '';
    activeGamelistCategory = GAMELIST_ALL_CATEGORY;
    renderGamelistCategoryStrip();
    setGamelistPlayableFilter('all');
    setGamelistSort('newest');

    const shouldReloadDefault = hadSearch || previousContentType !== 'default-popular' || !gamelistLoadedGamesCache.length;
    if (shouldReloadDefault) {
        fetchAndDisplayDefaultGamelist();
        return;
    }

    renderGamelistGames(gamelistLoadedGamesCache, { updateCache: false });
    setGamelistStatus('', 'info');
}

function updateGamelistCategoryArrows() {
    if (!gamelistCategoryScroller || !gamelistCategoryPrev || !gamelistCategoryNext || !gamelistCategoryStrip) return;
    if (gamelistCategoryStrip.style.display === 'none') return;

    const maxScroll = gamelistCategoryScroller.scrollWidth - gamelistCategoryScroller.clientWidth;
    const canScroll = maxScroll > 2;
    gamelistCategoryPrev.style.display = canScroll ? 'inline-flex' : 'none';
    gamelistCategoryNext.style.display = canScroll ? 'inline-flex' : 'none';
    gamelistCategoryPrev.disabled = !canScroll || gamelistCategoryScroller.scrollLeft <= 2;
    gamelistCategoryNext.disabled = !canScroll || gamelistCategoryScroller.scrollLeft >= maxScroll - 2;
}

function applyGamelistCategoryFilter() {
    // Category chips fetch fresh Steam results; cards are not filtered from "All".
}

function renderGamelistCategoryStrip() {
    if (!gamelistCategoryStrip || !gamelistCategoryScroller || !gamelistGameList) return;

    if (activeGamelistCategory !== GAMELIST_ALL_CATEGORY &&
        !GAMELIST_POPULAR_CATEGORIES.some(category => category.toLowerCase() === activeGamelistCategory.toLowerCase())) {
        activeGamelistCategory = GAMELIST_ALL_CATEGORY;
    }

    gamelistCategoryStrip.style.display = 'flex';
    gamelistCategoryScroller.innerHTML = '';

    [GAMELIST_ALL_CATEGORY, ...GAMELIST_POPULAR_CATEGORIES].forEach(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gamelist-category-chip';
        button.textContent = category;
        button.dataset.category = category;
        if (category.toLowerCase() === activeGamelistCategory.toLowerCase()) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            if (isGamelistLoading || isGamelistLoadingMore) return;
            if (category.toLowerCase() === activeGamelistCategory.toLowerCase()) return;
            activeGamelistCategory = category;
            gamelistCategoryScroller.querySelectorAll('.gamelist-category-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.category.toLowerCase() === category.toLowerCase());
            });
            if (category === GAMELIST_ALL_CATEGORY) {
                fetchAndDisplayDefaultGamelist();
            } else {
                fetchAndDisplayGamelistCategory(category);
            }
        });
        gamelistCategoryScroller.appendChild(button);
    });

    requestAnimationFrame(updateGamelistCategoryArrows);
}

function resetGamelistCategoryFilter() {
    activeGamelistCategory = GAMELIST_ALL_CATEGORY;
    renderGamelistCategoryStrip();
}

function renderGamelistGames(gamesToRender, options = {}) {
    if (!gamelistGameList) return;
    if (options.updateCache !== false) {
        gamelistLoadedGamesCache = dedupeGamelistGames(gamesToRender);
    }

    const orderedGames = getOrderedGamelistGames(gamelistLoadedGamesCache);

    gamelistGameList.innerHTML = '';
    gamelistSeenAppIds.clear();
    renderGamelistCategoryStrip();

    //if (!isUserCurrentlyPremium) { return; }
     if (orderedGames.length === 0) {
        if (gamelistLoadedGamesCache.length > 0 && activeGamelistPlayableFilter !== 'all') {
             const label = activeGamelistPlayableFilter === 'playable' ? 'playable' : 'not playable';
             setGamelistStatus(`No ${label} games match the current list.`, 'info');
        } else if (!gamelistSearchView.value.trim() && !gamelistStatusMessage.textContent.startsWith("Loading")) {
             setGamelistStatus('No games to display. Try searching or check popular new releases.', 'info');
        }
        return;
    }

    if (activeGamelistPlayableFilter !== 'all' && !isGamelistLoading && !isGamelistLoadingMore) {
        setGamelistStatus('', 'info');
    }
    appendGamelistGames(orderedGames);
}

function appendGamelistGames(gamesToRender) {
    if (!gamelistGameList || !gamesToRender || gamesToRender.length === 0) return;

    gamesToRender.forEach(game => {
        const appIdKey = String(game.appId);
        
        // --- NEW: If this game's AppID is in our featuredAppIdsSet, force featured = true ---
        if (featuredAppIdsSet && featuredAppIdsSet.has(appIdKey)) {
            game.featured = true;
        }

        if (gamelistSeenAppIds.has(appIdKey)) return;
        gamelistSeenAppIds.add(appIdKey);

        const item = document.createElement('div');
        item.className = 'game-item gamelist-game-item';
        if (game.featured) item.classList.add('gamelist-featured');
        item.dataset.appId = game.appId;
        item.dataset.categories = JSON.stringify(getGamelistCategories(game));

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'gamelist-thumb-wrap';

        const img = document.createElement('img');
        img.src = game.imageUrl || GAME_IMAGE_PLACEHOLDER;
        img.onerror = () => { img.src = GAME_IMAGE_PLACEHOLDER; };
        thumbWrap.appendChild(img);

        const hasBypass = hasBypassForAppId(game.appId);
        const needsActivation = !hasBypass && shouldShowActivationBadge(game);
        if (hasBypass || needsActivation) {
            const badgeStack = document.createElement('div');
            badgeStack.className = 'gamelist-thumb-badges';

            if (hasBypass) {
                const bypassBadge = document.createElement('span');
                bypassBadge.className = 'gamelist-thumb-badge bypass';
                bypassBadge.textContent = 'BYPASS AVAILABLE';
                badgeStack.appendChild(bypassBadge);
            }

            if (needsActivation) {
                const activationBadge = document.createElement('span');
                activationBadge.className = 'gamelist-thumb-badge activation';
                activationBadge.textContent = 'MANUAL ACTIVATION';
                badgeStack.appendChild(activationBadge);
            }

            thumbWrap.appendChild(badgeStack);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'game-info gamelist-game-info';

        const nameP = document.createElement('p');
        nameP.className = 'game-name gamelist-game-name';
        nameP.textContent = game.name;

        const appIdStatusWrapper = document.createElement('div');
        appIdStatusWrapper.className = 'appid-status-wrapper';

        const appIdP = document.createElement('p');
        appIdP.className = 'game-appid gamelist-game-appid';
        appIdP.textContent = `AppID: ${game.appId}`;
        appIdP.addEventListener('click', (e) => {
            e.stopPropagation(); copyToClipboard(appIdP, game.appId);
        });

        appIdStatusWrapper.appendChild(appIdP);

        const drmStatusDiv = document.createElement('div');
        drmStatusDiv.className = 'gamelist-drm-status';
        let drmText = game.displayStatus.replace(/_/g, ' ').toUpperCase();
        drmStatusDiv.classList.add(game.displayStatus);

        if (game.displayStatus === 'playable') drmText = "GAME PLAYABLE";
        else if (game.displayStatus === 'not_playable') drmText = `NOT PLAYABLE`;
        else if (game.displayStatus === 'free_to_play') drmText = "FREE TO PLAY";
        else if (game.displayStatus === 'api_error') drmText = "API ERROR";
        else if (game.displayStatus === 'store_invalid') drmText = "INVALID (STORE)";
        else if (game.displayStatus === 'store_error') drmText = "STORE PAGE ERROR";
        else if (game.displayStatus === 'coming_soon') drmText = "COMING SOON";

        drmStatusDiv.textContent = drmText;
        appIdStatusWrapper.appendChild(drmStatusDiv);

        infoDiv.appendChild(nameP);
        infoDiv.appendChild(appIdStatusWrapper);


        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'game-item-actions gamelist-game-actions';

        // Featured games (the special JSON) always show "Add to Steam".
        // Regular games: premium/trial users get "Add to Steam", free users get "Copy AppID".
        if (game.featured || isPremiumMember()) {
            // "Add to Steam" button (same process-appid download API used by the DRM Unlocker)
            const addBtn = document.createElement('button');
            addBtn.className = 'game-item-button add-btn gamelist-addsteam-btn';
            addBtn.style.fontWeight = '600';
            addBtn.style.gap = '6px';
            addBtn.dataset.appId = game.appId;
            const ADD_LABEL = '<i class="fab fa-steam"></i> Add to Steam';
            addBtn.innerHTML = ADD_LABEL;

            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.electronAPI.send('process-appid', String(game.appId), true, true);
                addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            });
            actionsDiv.appendChild(addBtn);
        } else {
            // Regular game: "Copy AppID" button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'game-item-button add-btn gamelist-copyid-btn';
            copyBtn.style.fontWeight = '600';
            copyBtn.style.gap = '6px';
            copyBtn.dataset.appId = game.appId;
            const COPY_LABEL = '<i class="fas fa-copy"></i> Copy AppID';
            copyBtn.innerHTML = COPY_LABEL;
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(String(game.appId)).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.classList.add('copied-feedback');
                    setTimeout(() => { copyBtn.innerHTML = COPY_LABEL; copyBtn.classList.remove('copied-feedback'); }, 1500);
                }).catch(() => {
                    copyBtn.innerHTML = '<i class="fas fa-times"></i> Failed';
                    copyBtn.classList.add('copy-failed-feedback');
                    setTimeout(() => { copyBtn.innerHTML = COPY_LABEL; copyBtn.classList.remove('copy-failed-feedback'); }, 1500);
                });
            });
            actionsDiv.appendChild(copyBtn);
        }

        item.appendChild(thumbWrap);
        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);
        gamelistGameList.appendChild(item);
    });

    renderGamelistCategoryStrip();
}

// Pinned/featured AppIDs that should always appear first in the Game List.
// (The source URL lives in compiled main; fetched by the 'featuredAppIds' key.)
let featuredGamesCache = null;
let featuredAppIdsSet = new Set();

async function getFeaturedGames() {
    if (featuredGamesCache) return featuredGamesCache;
    try {
        const res = await window.electronAPI.invoke('app-fetch-endpoint', 'featuredAppIds');
        if (!res || !res.success || !res.text) { return []; }
        const ids = res.text.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
        featuredAppIdsSet = new Set(ids);
        if (!ids.length) return [];

        const settled = await Promise.allSettled(
            ids.map(id => window.electronAPI.invoke('get-game-extended-info', id, null))
        );
        const games = settled.map((r, i) => {
            if (r.status === 'fulfilled' && r.value && r.value.success && r.value.gameData) {
                const gd = r.value.gameData;
                gd.featured = true;
                return gd;
            }
            // Fallback minimal card so the pinned game still shows.
            return {
                appId: ids[i],
                name: 'AppID ' + ids[i],
                imageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${ids[i]}/header.jpg`,
                displayStatus: 'unknown',
                featured: true
            };
        });
        featuredGamesCache = games;
        return games;
    } catch (e) {
        addLog && addLog('Featured AppIDs load error.', 'error');
        return [];
    }
}

async function fetchAndDisplayDefaultGamelist() {
    if (isGamelistLoading) return;
    isGamelistLoading = true;
    activeGamelistCategory = GAMELIST_ALL_CATEGORY;
    renderGamelistCategoryStrip();

    setGamelistStatus(`Loading popular new releases...`, 'info');
    if (gamelistGameList) {
        gamelistGameList.innerHTML = '';
        delete gamelistGameList.dataset.contentType;
    }
    gamelistLoadedGamesCache = [];
    gamelistSeenAppIds.clear();
    gamelistNextStart = 0;
    gamelistHasMore = false;
    if (gamelistSearchView) gamelistSearchView.disabled = true;
    if (gamelistSearchButton) gamelistSearchButton.disabled = true;

    try {
        await loadLibraryBypassGames(false);
        const featured = !isPremiumMember() ? await getFeaturedGames() : [];
        const result = await window.electronAPI.invoke('scrape-steam250-chart', 'week'); // 'week' is an identifier, not a URL
        if (result.success && result.games && result.games.length > 0) {
            renderGamelistGames([...featured, ...result.games]);   // pinned AppIDs first
            if (gamelistGameList) gamelistGameList.dataset.contentType = 'default-popular';
            gamelistHasMore = true; // Enable infinite scroll for default popular view
            gamelistNextStart = 0;  // Paginated source is independent of the chart cache; dedup handles overlap
            setGamelistStatus('', 'info');
        } else if (result.success && result.games && result.games.length === 0) {
            renderGamelistGames(featured);
            if (!featured.length) setGamelistStatus(result.message || `No suitable games found in popular new releases.`, 'info'); // result.message sanitized by main
            else setGamelistStatus('', 'info');
        } else {
            renderGamelistGames(featured);
            if (!featured.length) setGamelistStatus(result.message || `Failed to load popular new releases.`, 'error'); // result.message sanitized by main
            else setGamelistStatus('', 'info');
        }
    } catch (error) {
        renderGamelistGames([]);
        setGamelistStatus(`Error loading popular new releases.`, 'error');
        addLog(`GameList Default Load Error.`, 'error');
    } finally {
        if (gamelistSearchView) gamelistSearchView.disabled = false;
        if (gamelistSearchButton) gamelistSearchButton.disabled = false;
        isGamelistLoading = false;
        requestMoreGamelistFilteredResults();
    }
}

async function fetchAndDisplayGamelistCategory(category) {
    if (!gamelistGameList || !gamelistStatusMessage || isGamelistLoading) return;

    activeGamelistCategory = category;
    renderGamelistCategoryStrip();
    isGamelistLoading = true;

    if (gamelistSearchView) gamelistSearchView.value = '';
    setGamelistStatus(`Loading ${category} games...`, 'info');
    gamelistGameList.innerHTML = '';
    gamelistLoadedGamesCache = [];
    gamelistSeenAppIds.clear();
    gamelistNextStart = 0;
    gamelistHasMore = false;
    if (gamelistSearchView) gamelistSearchView.disabled = true;
    if (gamelistSearchButton) gamelistSearchButton.disabled = true;

    try {
        await loadLibraryBypassGames(false);
        const result = await window.electronAPI.invoke('fetch-gamelist-category', category, 0, GAMELIST_PAGE_SIZE);
        if (result && result.success && result.games && result.games.length > 0) {
            renderGamelistGames(result.games);
            gamelistGameList.dataset.contentType = `category:${category}`;
            gamelistNextStart = typeof result.nextStart === 'number' ? result.nextStart : GAMELIST_PAGE_SIZE;
            gamelistHasMore = !!result.hasMore;
            setGamelistStatus('', 'info');
        } else {
            renderGamelistGames([]);
            gamelistGameList.dataset.contentType = `category:${category}`;
            setGamelistStatus(result?.message || `No ${category} games found.`, result?.success ? 'info' : 'error');
        }
    } catch (error) {
        renderGamelistGames([]);
        setGamelistStatus(`Error loading ${category} games.`, 'error');
        addLog(`GameList Category Load Error.`, 'error');
    } finally {
        if (gamelistSearchView) gamelistSearchView.disabled = false;
        if (gamelistSearchButton) gamelistSearchButton.disabled = false;
        isGamelistLoading = false;
        renderGamelistCategoryStrip();
        requestMoreGamelistFilteredResults();
    }
}


async function fetchAndDisplayGamelistGame() {
    if (!gamelistGameList || !gamelistStatusMessage || !gamelistSearchView || isGamelistLoading) return;
    // if (!isUserCurrentlyPremium) { renderGamelistGames([]); return; }

    const searchTerm = gamelistSearchView.value.trim();

    if (!searchTerm) {
        if (gamelistGameList && gamelistGameList.dataset.contentType !== 'default-popular') {
            fetchAndDisplayDefaultGamelist();
        }
        return;
    }

    isGamelistLoading = true;
    activeGamelistCategory = GAMELIST_ALL_CATEGORY;
    renderGamelistCategoryStrip();

    setGamelistStatus(`Searching for "${searchTerm}"...`, 'info');
    gamelistGameList.innerHTML = '';
    delete gamelistGameList.dataset.contentType;
    gamelistLoadedGamesCache = [];
    gamelistSeenAppIds.clear();
    gamelistNextStart = 0;
    gamelistHasMore = false; // Disable infinite scroll for search results
    gamelistSearchView.disabled = true;
    if(gamelistSearchButton) gamelistSearchButton.disabled = true;


    try {
        await loadLibraryBypassGames(false);
        if (searchTerm.match(/^\d+$/)) {
            const result = await window.electronAPI.invoke('get-game-extended-info', searchTerm, null);
            if (result.success && result.gameData) {
                
                // --- NEW: STRICTLY ALLOW ONLY "GAME" TYPES ---
                const gameType = result.gameData.type ? result.gameData.type.toLowerCase() : 'game';
                if (gameType !== 'game') {
                    renderGamelistGames([]);
                    setGamelistStatus(`AppID ${searchTerm} is a ${gameType}. Only base games are shown.`, 'warning');
                    return;
                }

                renderGamelistGames([result.gameData]);
                if (gamelistGameList) gamelistGameList.dataset.contentType = 'search-results';
                setGamelistStatus('', 'info');
                
            } else {
                renderGamelistGames([]);
                const errorMessage = result.gameData?.name ? `Info: ${result.gameData.name}` : (result.message || `Failed to fetch info for AppID: ${searchTerm}.`); 
                setGamelistStatus(errorMessage, 'error');
            }
        } else {
            const titleSearchResult = await window.electronAPI.invoke('find-appid-by-title', searchTerm);
            if (titleSearchResult.success && titleSearchResult.games && titleSearchResult.games.length > 0) {
                setGamelistStatus(`Found ${titleSearchResult.games.length} potential match(es). Fetching details...`, 'info');

                const detailPromises = titleSearchResult.games.map(gameSummary =>
                    window.electronAPI.invoke('get-game-extended-info', gameSummary.appId, gameSummary.name)
                );

                const settledResults = await Promise.allSettled(detailPromises);

                // --- NEW: STRICTLY ALLOW ONLY "GAME" TYPES ---
                const gamesToDisplay = settledResults
                    .filter(r => {
                        if (r.status !== 'fulfilled' || !r.value.success || !r.value.gameData) return false;
                        const type = r.value.gameData.type ? r.value.gameData.type.toLowerCase() : 'game';
                        return type === 'game';
                    })
                    .map(r => r.value.gameData);

                if (gamesToDisplay.length > 0) {
                    renderGamelistGames(gamesToDisplay);
                    if (gamelistGameList) gamelistGameList.dataset.contentType = 'search-results';
                    setGamelistStatus('', 'info');
                } else {
                    renderGamelistGames([]);
                    const failedCount = settledResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
                    if (failedCount > 0 && failedCount === titleSearchResult.games.length) {
                         setGamelistStatus(`Could not fetch details for any games matching "${searchTerm}".`, 'error');
                    } else {
                         setGamelistStatus(`No base games found matching "${searchTerm}" (DLCs and Soundtracks are hidden).`, 'warning');
                    }
                }
            } else {
                renderGamelistGames([]);
                setGamelistStatus(titleSearchResult.message || `No games found matching "${searchTerm}".`, 'error'); 
            }
        }
    } catch (error) {
        renderGamelistGames([]);
        setGamelistStatus(`Error during search for "${searchTerm}".`, 'error');
        addLog(`GameList Fetch Error.`, 'error');
    } finally {
        gamelistSearchView.disabled = false;
        if(gamelistSearchButton) gamelistSearchButton.disabled = false;
        isGamelistLoading = false;
        if (gamelistView.classList.contains('active-view') && gamelistSearchView.value.trim()) gamelistSearchView.focus();
    }
}


if (gamelistSearchView) {
    gamelistSearchView.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !isGamelistLoading) {
            fetchAndDisplayGamelistGame();
        }
    });
    gamelistSearchView.addEventListener('input', () => {
        if (gamelistSearchView.value.trim() === '') {
            if (!isGamelistLoading && gamelistView.classList.contains('active-view')) {
                if (gamelistGameList && gamelistGameList.dataset.contentType !== 'default-popular') {
                     fetchAndDisplayDefaultGamelist();
                }
            }
        }
    });
}

if (gamelistSearchButton) {
    gamelistSearchButton.addEventListener('click', () => {
        if (!isGamelistLoading) fetchAndDisplayGamelistGame();
    });
}

async function loadMoreGamelist() {
    if (!gamelistGameList) return;
    if (isGamelistLoading || isGamelistLoadingMore || !gamelistHasMore) return;
    const contentType = gamelistGameList.dataset.contentType || '';
    const isDefaultFeed = contentType === 'default-popular';
    const isCategoryFeed = contentType.startsWith('category:');
    if (!isDefaultFeed && !isCategoryFeed) return;

    isGamelistLoadingMore = true;

    const loader = document.createElement('div');
    loader.className = 'gamelist-loading-more';
    loader.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 16px; color: var(--text-muted, #888); font-size: 13px;';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading more games...';
    gamelistGameList.appendChild(loader);

    let appendedCount = 0;
    try {
        await loadLibraryBypassGames(false);
        const result = isCategoryFeed
            ? await window.electronAPI.invoke('fetch-gamelist-category', activeGamelistCategory, gamelistNextStart, GAMELIST_PAGE_SIZE)
            : await window.electronAPI.invoke('fetch-more-gamelist', gamelistNextStart, GAMELIST_PAGE_SIZE);
        if (result && result.success) {
            const renderedBefore = getGamelistRenderedCount();
            const loadedAppIds = new Set(gamelistLoadedGamesCache.map(g => String(g.appId)));
            const fresh = (result.games || []).filter(g => g && g.appId && !loadedAppIds.has(String(g.appId)));
            if (fresh.length > 0) {
                const previousScrollTop = gamelistGameList.scrollTop;
                gamelistLoadedGamesCache = dedupeGamelistGames([...gamelistLoadedGamesCache, ...fresh]);
                renderGamelistGames(gamelistLoadedGamesCache, { updateCache: false });
                gamelistGameList.scrollTop = previousScrollTop;
            }
            appendedCount = hasActiveGamelistPlayableFilter()
                ? Math.max(0, getGamelistRenderedCount() - renderedBefore)
                : fresh.length;
            gamelistNextStart = typeof result.nextStart === 'number' ? result.nextStart : (gamelistNextStart + GAMELIST_PAGE_SIZE);
            gamelistHasMore = !!result.hasMore;
        } else {
            gamelistHasMore = false;
        }
    } catch (err) {
        gamelistHasMore = false;
        addLog('GameList: Failed to load more games.', 'error');
    } finally {
        loader.remove();
        isGamelistLoadingMore = false;
        if (hasActiveGamelistPlayableFilter() && getGamelistRenderedCount() > 0) {
            setGamelistStatus('', 'info');
        }
    }

    // If a page came back with nothing new (all dedup'd) but more pages remain,
    // chain another fetch — the user is already at the bottom and can't re-trigger scroll.
    if ((appendedCount === 0 || (hasActiveGamelistPlayableFilter() && needsMoreGamelistRowsForScroll())) && gamelistHasMore) {
        loadMoreGamelist();
    }
}

(function setupGamelistInfiniteScroll() {
    const threshold = 300;
    const maybeLoad = (target) => {
        if (!target) return;
        if (!gamelistView || !gamelistView.classList.contains('active-view')) return;
        const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (remaining < threshold) loadMoreGamelist();
    };
    if (gamelistGameList) {
        gamelistGameList.addEventListener('scroll', () => maybeLoad(gamelistGameList));
    }
    const mainArea = document.getElementById('mainContentArea');
    if (mainArea) {
        mainArea.addEventListener('scroll', () => maybeLoad(mainArea));
    }
})();

if (gamelistCategoryScroller) {
    gamelistCategoryScroller.addEventListener('scroll', updateGamelistCategoryArrows);
}
if (gamelistCategoryPrev && gamelistCategoryScroller) {
    gamelistCategoryPrev.addEventListener('click', () => {
        gamelistCategoryScroller.scrollBy({ left: -260, behavior: 'smooth' });
    });
}
if (gamelistCategoryNext && gamelistCategoryScroller) {
    gamelistCategoryNext.addEventListener('click', () => {
        gamelistCategoryScroller.scrollBy({ left: 260, behavior: 'smooth' });
    });
}
if (gamelistSortSelect && gamelistSortButton && gamelistSortOptions) {
    setGamelistSort(activeGamelistSort);

    gamelistSortButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeGamelistPlayableMenu();
        const willOpen = !gamelistSortSelect.classList.contains('open');
        gamelistSortSelect.classList.toggle('open', willOpen);
        gamelistSortButton.setAttribute('aria-expanded', String(willOpen));
    });

    gamelistSortOptions.querySelectorAll('.gamelist-sort-option').forEach(option => {
        option.addEventListener('click', (event) => {
            event.stopPropagation();
            setGamelistSort(option.dataset.value);
            closeGamelistSortMenu();
        });
    });

    document.addEventListener('click', (event) => {
        if (!gamelistSortSelect.contains(event.target)) {
            closeGamelistSortMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeGamelistSortMenu();
    });
}
if (gamelistPlayableSelect && gamelistPlayableButton && gamelistPlayableOptions) {
    setGamelistPlayableFilter(activeGamelistPlayableFilter);

    gamelistPlayableButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeGamelistSortMenu();
        const willOpen = !gamelistPlayableSelect.classList.contains('open');
        gamelistPlayableSelect.classList.toggle('open', willOpen);
        gamelistPlayableButton.setAttribute('aria-expanded', String(willOpen));
    });

    gamelistPlayableOptions.querySelectorAll('.gamelist-playable-option').forEach(option => {
        option.addEventListener('click', (event) => {
            event.stopPropagation();
            setGamelistPlayableFilter(option.dataset.value);
            closeGamelistPlayableMenu();
        });
    });

    document.addEventListener('click', (event) => {
        if (!gamelistPlayableSelect.contains(event.target)) {
            closeGamelistPlayableMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeGamelistPlayableMenu();
    });
}
if (gamelistClearFilterButton) {
    gamelistClearFilterButton.addEventListener('click', resetGamelistFiltersToDefault);
}
window.addEventListener('resize', updateGamelistCategoryArrows);

function copyToClipboard(element, text) {
    const originalText = element.textContent;
    if (activeAppIdCopyTimeout && element.dataset.copyTimeoutId === String(activeAppIdCopyTimeout)) {
        clearTimeout(activeAppIdCopyTimeout);
    }

    navigator.clipboard.writeText(text).then(() => {
        element.textContent = "Copied!";
        element.classList.add('copied-feedback');
        element.classList.remove('copy-failed-feedback');
        const timeoutId = setTimeout(() => {
            if (element.classList.contains('appid-status-wrapper')) {
                const appIdTextNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.startsWith("AppID:"));
                if(appIdTextNode) appIdTextNode.textContent = `AppID: ${text}`;
                else element.childNodes[0].textContent = `AppID: ${text}`;
                const statusTag = element.querySelector('.gamelist-drm-status');
                if(!statusTag && element.dataset.originalStatusHtml) {
                   const tempDiv = document.createElement('div');
                   tempDiv.innerHTML = element.dataset.originalStatusHtml;
                   element.appendChild(tempDiv.firstChild);
                }

            } else {
                 element.textContent = originalText;
            }
            element.classList.remove('copied-feedback');
        }, 1500);
        activeAppIdCopyTimeout = timeoutId;
        element.dataset.copyTimeoutId = String(timeoutId);

        if(element.classList.contains('appid-status-wrapper')) {
            const statusTag = element.querySelector('.gamelist-drm-status');
            if(statusTag) element.dataset.originalStatusHtml = statusTag.outerHTML;
        }

    }).catch(err => {
        console.error('Failed to copy AppID.');
        element.textContent = "Copy Failed!";
        element.classList.add('copy-failed-feedback');
        element.classList.remove('copied-feedback');
        const timeoutId = setTimeout(() => {
            if (element.classList.contains('appid-status-wrapper')) {
                 const appIdTextNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.startsWith("AppID:"));
                 if(appIdTextNode) appIdTextNode.textContent = `AppID: ${text}`;
                 else element.childNodes[0].textContent = `AppID: ${text}`;
                const statusTag = element.querySelector('.gamelist-drm-status');
                if(!statusTag && element.dataset.originalStatusHtml) {
                   const tempDiv = document.createElement('div');
                   tempDiv.innerHTML = element.dataset.originalStatusHtml;
                   element.appendChild(tempDiv.firstChild);
                }
            } else {
                 element.textContent = originalText;
            }
            element.classList.remove('copy-failed-feedback');
        }, 1500);
        activeAppIdCopyTimeout = timeoutId;
        element.dataset.copyTimeoutId = String(timeoutId);
    });
}


document.addEventListener('click', (event) => {
    const linkElement = event.target.closest('a[target="_blank"]');
    if (linkElement?.href && (linkElement.protocol === 'http:' || linkElement.protocol === 'https:')) {
        event.preventDefault(); window.electronAPI.send('open-external-url', linkElement.href); // href is fine to send, main.js will handle it
    }
});

// Custom Title Bar Close Button Handler
if (closeAppButton) {
    closeAppButton.addEventListener('click', () => {
        window.electronAPI.send('close-app');
    });
}

const minimizeAppButton = document.getElementById('minimizeAppButton');
if (minimizeAppButton) {
    minimizeAppButton.addEventListener('click', () => {
        window.electronAPI.send('minimize-app');
    });
}

const maximizeAppButton = document.getElementById('maximizeAppButton');
if (maximizeAppButton) {
    maximizeAppButton.addEventListener('click', () => {
        window.electronAPI.send('maximize-app');
    });
}


window.electronAPI.on('status-update', (message, type = 'info') => {
    addLog(message, type);

    const endMessages = [
        "Process completed in", "Process completed for AppID", "Process failed or was aborted for AppID",
        "Finished:", "Deletion process completed for AppID", "File drop processing finished.",
        "Download location selection cancelled.", "Download location set.", "Download location reset to default.", // Updated generic messages
        "Process completed",
        "Game successfully deleted",
        "No Game Found",
        "Invalid AppID",
        "Store Page DRM Check System Error", // This is a system error type, not a path/URL
        "DB source S1 check failed", // This is a type of failure, not a path/URL
        "Limited DB source check failed", // Type of failure
        "DB source S2 check failed", // Type of failure
        "Download process failed",
        "Download/processing failed",
        "Steam process stopped successfully.", // "Steam" is fine, it's the app name.
        "Issued stop command, but Steam might still be running or closing slowly.",
        "Failed to stop Steam or it was not running."
    ];

    const isEndMessage = endMessages.some(endMsg => message.includes(endMsg));
    const isErrorOrWarning = type === 'error' || type === 'warning' || message.toLowerCase().includes('fail') || message.toLowerCase().includes('error');

    const libraryProcessingButton = document.querySelector(`.library-game-item .game-item-button i.${PROCESSING_ICON_CLASS.replaceAll(' ','.')}`);
    const isLibraryUpdate = !!libraryProcessingButton;

    const isGamelistError = message.startsWith("GameList Default Load Error") || message.startsWith("GameList Fetch Error");

    if ((isEndMessage || isErrorOrWarning) && !isLibraryUpdate && !message.startsWith("Chart:") && !isGamelistError) {
        if (type !== 'progress') lastProgressMessageElement = null;

        [processAppIdButton, deleteIdButton, setSaveLocationButton, appIdInput].forEach(el => el && (el.disabled = false));
        if (steamActionButton) {
            const iconEl = steamActionButton.querySelector('i');
            if (iconEl && !iconEl.className.includes(ERROR_ICON_CLASS)) steamActionButton.disabled = false;
        }

        const shouldClearInput = isEndMessage && type === 'success' &&
                               !message.includes("deletion") &&
                               !message.toLowerCase().includes("invalid appid") &&
                               !message.toLowerCase().includes("no game found") &&
                               (message.includes("Process completed in") || message.includes("Process completed for AppID"));

        if (shouldClearInput && appIdInput) {
            appIdInput.value = '';
        }
        if (appIdInput && homeView.classList.contains('active-view') && !appIdInput.disabled) {
             appIdInput.focus();
        }
    }
});

window.electronAPI.on('dlc-operation-status', (message, type = 'info') => {
    addLog(message, type);
});

window.electronAPI.on('dlc-toggle-result', ({ appId, added }) => {
    updateCachedDlcState(appId, added);
    const toggle = document.querySelector(`#dlcGameList .game-item[data-app-id="${appId}"] .update-toggle-input`);
    if (toggle) {
        toggle.checked = !!added;
        toggle.disabled = false;
    }
    updateLibraryDlcButtonsForApp(appId);
    if (activeDlcCardButtons && activeDlcCardButtons.appId === String(appId)) activeDlcCardButtons = null;
});


window.electronAPI.on('auth-result', ({ success, message, readmeText, isPremium, expirationInfo, userCode, guestCode, userStatus, trialDays }) => {
    const wasPremiumMember = isPremiumMember(); // based on the previous membership status
    isUserCurrentlyPremium = isPremium;
    currentUserStatus = (success && userStatus) ? userStatus : 'free';

    // If membership changed (e.g. free -> premium re-login without restarting the app),
    // the Download Hub action buttons flip (Copy AppID <-> Add to Steam). Drop the cached
    // list so it re-renders with the correct buttons instead of showing stale ones.
    if (wasPremiumMember !== isPremiumMember()) {
        if (gamelistGameList) {
            gamelistGameList.innerHTML = '';
            delete gamelistGameList.dataset.contentType;
        }
        gamelistSeenAppIds.clear();
        resetGamelistCategoryFilter();
        gamelistNextStart = 0;
        gamelistHasMore = false;
        isGamelistLoading = false;
        // Re-render right away if the user is already looking at the Download Hub.
        if (success && gamelistView && gamelistView.classList.contains('active-view')
            && !(gamelistSearchView && gamelistSearchView.value.trim())) {
            fetchAndDisplayDefaultGamelist();
        }
    }

    if (authInitialMessage) authInitialMessage.style.display = 'none';
    if (authLoader) authLoader.style.display = 'none';

    if (success) {
        updateMembershipBadge(userStatus, trialDays);
        if (membershipBadge) membershipBadge.style.display = 'inline-block';
    } else {
        updateMembershipBadge('free');
        if (membershipBadge) membershipBadge.style.display = 'none';
        
        // Clear Live Chat history and connection on logout/failed auth
        if (chatSocket) {
            try {
                chatSocket.disconnect();
            } catch (err) {
                console.error("Error disconnecting chat socket:", err);
            }
            chatSocket = null;
        }
        chatUserCode = null;
        if (appChatMessages) {
            appChatMessages.innerHTML = '';
        }
        const typingIndicator = document.getElementById('chatTypingIndicator');
        if (typingIndicator) {
            typingIndicator.textContent = '';
        }
        const badge = document.getElementById('chatAttachmentBadge');
        if (badge) {
            badge.style.display = 'none';
        }
        const fileInput = document.getElementById('appChatFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        updateClientChatUnreadBadge(0);
    }

    if (authReadme) {
        if (readmeText && !success) {
            authReadme.textContent = readmeText;
            authReadme.style.display = 'block';
        } else {
            authReadme.style.display = 'none';
        }
    }

    setPremiumUI(isUserCurrentlyPremium);

    if (success && userCode) {
        const promptContainer = document.getElementById('chatNamePromptContainer');
        const mainWrapper = document.getElementById('chatMainWrapper');

        if (userCode === 'fomiopalma') {
            const savedName = localStorage.getItem('free_user_name');
            if (savedName) {
                chatUserCode = 'free-' + savedName;
                if (promptContainer) promptContainer.style.display = 'none';
                if (mainWrapper) mainWrapper.style.display = 'flex';
                initLiveChat();
            } else {
                if (promptContainer) promptContainer.style.display = 'flex';
                if (mainWrapper) mainWrapper.style.display = 'none';
            }
        } else {
            chatUserCode = userCode;
            if (promptContainer) promptContainer.style.display = 'none';
            if (mainWrapper) mainWrapper.style.display = 'flex';
            initLiveChat();
        }
    }

    if (success) {
        lastProgressMessageElement = null;
        if (authSection) authSection.style.display = 'none';
        if (mainAppSection) mainAppSection.style.display = 'flex';
        if (pageBottomRightButtonContainer) {
            pageBottomRightButtonContainer.style.display = 'none';
        }

        if (expirationStatusDisplay) {
            let expirationText = expirationInfo || '';
            expirationStatusDisplay.textContent = expirationText;
            expirationStatusDisplay.className = 'expiration-status';
            expirationStatusDisplay.style.display = expirationText ? 'block' : 'none';
        }

        addLog('Authentication successful.', 'success');
        switchView(homeView, menuHomeButton);
        libraryGamesCache = [];
        dlcGamesCache = [];

        if (appIdInput && homeView.classList.contains('active-view')) appIdInput.focus();

        window.electronAPI.invoke('get-current-download-location').then(pathString => { // pathString is now "Default Location" or "Custom Location"
            if (currentSavePathInput) currentSavePathInput.value = pathString || "Default Location";
        });
        window.electronAPI.invoke('get-auto-save-state').then(enabled => {
            if (autoPlaceToggle) autoPlaceToggle.checked = enabled;
        });
        window.electronAPI.invoke('get-dlc-mode-state').then(enabled => {
            if (dlcModeToggle) dlcModeToggle.checked = isUserCurrentlyPremium ? enabled : false;
        });
        window.electronAPI.invoke('get-unlock-game-state').then(enabled => {
            if (unlockGameToggle) unlockGameToggle.checked = enabled;
        });

    } else {
        if (mainAppSection) mainAppSection.style.display = 'none';
        if (authSection) authSection.style.display = 'flex';
        if (authFormElements) authFormElements.style.display = 'flex';
        if (pageBottomRightButtonContainer) {
            pageBottomRightButtonContainer.style.display = 'block';
        }
        if (expirationStatusDisplay) expirationStatusDisplay.style.display = 'none';

        if (authStatus) {
            authStatus.textContent = ''; authStatus.className = '';
            if (authStatusTimeout) { clearTimeout(authStatusTimeout); authStatusTimeout = null; }
            const currentDisplayMessage = message || 'Authentication Required';
            authStatus.textContent = currentDisplayMessage;
            authStatus.className = (message && (message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') || message.toLowerCase().includes('expired'))) ? 'error' : '';
            authStatus.style.display = 'block';

            if (message) {
                authStatusTimeout = setTimeout(() => {
                    if (authStatus) { authStatus.textContent = ''; authStatus.className = ''; authStatus.style.display = 'none'; }
                }, 3000);
            }
        }
        if (authCodeInput) { authCodeInput.value = ''; authCodeInput.focus(); }
    }
});

window.electronAPI.on('steam-control-ready', () => {
    if (steamActionButton) { steamActionButton.style.display = 'inline-flex'; updateSteamButtonState(); }
});

window.electronAPI.on('version-mismatch', () => {
    addLog("Version mismatch! Updater launching. App will close.", "warning");
    if (mainAppSection) mainAppSection.style.display = 'none';
    if (authSection) authSection.style.display = 'none';
    if (pageBottomRightButtonContainer) pageBottomRightButtonContainer.style.display = 'none';
    document.querySelectorAll('button, input').forEach(el => el.disabled = true);
});

window.electronAPI.on('current-save-path', (pathString) => { // pathString is "Default Location" or "Custom Location"
    if (currentSavePathInput) currentSavePathInput.value = pathString || "Default Location";
});

window.electronAPI.on('auto-save-state-update', (enabled) => {
    if (autoPlaceToggle) {
        autoPlaceToggle.checked = enabled;
        updateGamelistButtonsText(); // Sync UI on startup
    }
});

window.electronAPI.on('dlc-mode-state-update', (enabled) => {
    if (dlcModeToggle) dlcModeToggle.checked = isUserCurrentlyPremium ? enabled : false;
});

window.electronAPI.on('unlock-game-state-update', (enabled) => {
    if (unlockGameToggle) {
        unlockGameToggle.checked = enabled;
    }
});

window.electronAPI.on('library-item-update-complete', ({ appId, success }) => {
    // The UPDATE button now lives in the Update view; scope the lookup to that list.
    const itemElement = document.querySelector(`#updateGameList .game-item[data-app-id="${appId}"]`);
    if (itemElement) {
        const updateBtn = itemElement.querySelector('.update-btn');
        const disableBtn = itemElement.querySelector('.disable-btn');

        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.textContent = 'UPDATE';
            updateBtn.classList.remove('success-flash', 'error-flash');
            if (success) {
                updateBtn.classList.add('success-flash');
            } else {
                updateBtn.classList.add('error-flash');
            }
            setTimeout(() => updateBtn.classList.remove('success-flash', 'error-flash'), 1500);
        }
        if (disableBtn) {
            disableBtn.disabled = false;
        }
    }
});

window.electronAPI.on('gamelist-item-process-complete', ({ appId, success }) => {
    const buttonSelector = `.gamelist-game-item[data-app-id="${appId}"] .gamelist-addsteam-btn`;
    const addBtn = document.querySelector(buttonSelector);

    if (addBtn) {
        const iconClass = 'fab fa-steam';
        const btnText = 'Add to Steam';

        addBtn.disabled = false;
        addBtn.classList.remove('success-flash', 'error-flash');
        if (success) {
            addBtn.classList.add('downloaded');
            addBtn.innerHTML = `<i class="fas fa-check"></i> Downloaded`;
            addBtn.classList.add('success-flash');
            
            // Revert back after 2.5 seconds
            setTimeout(() => {
                addBtn.classList.remove('downloaded', 'success-flash');
                addBtn.innerHTML = `<i class="${iconClass}"></i> ${btnText}`;
            }, 2500);
        } else {
            addBtn.classList.remove('downloaded');
            addBtn.innerHTML = `<i class="${iconClass}"></i> ${btnText}`;
            addBtn.classList.add('error-flash');
            setTimeout(() => addBtn.classList.remove('error-flash'), 1500);
        }
    }
});


window.addEventListener('beforeunload', () => {
    ['status-update', 'auth-result', 'version-mismatch',
     'steam-control-ready', 'current-save-path', 'auto-save-state-update', 'dlc-mode-state-update',
     'dlc-operation-status', 'library-item-update-complete', 'gamelist-item-process-complete',
     'unlock-game-state-update', 'dlc-toggle-result']
    .forEach(channel => window.electronAPI.removeAllListeners(channel));
});

document.addEventListener('DOMContentLoaded', () => {
    window.setTimeout(() => {
        const stillWaitingForAuth = authSection && authSection.style.display !== 'none' && authLoader && authLoader.style.display !== 'none';
        if (!stillWaitingForAuth) return;
        authLoader.style.display = 'none';
        if (authFormElements) authFormElements.style.display = 'flex';
        if (authStatus) {
            authStatus.textContent = 'Sign-in is taking longer than expected. Enter your code or continue as guest.';
            authStatus.className = 'warning';
            authStatus.style.display = 'block';
        }
    }, 15000);
    updateTitleBarVersion();

    isUserCurrentlyPremium = false;
    currentUserStatus = 'free';
    setPremiumUI(isUserCurrentlyPremium);
    updateMembershipBadge('free');
    if (membershipBadge) membershipBadge.style.display = 'none';

    // Pre-fetch featured games and populate featuredAppIdsSet
    getFeaturedGames().catch(e => console.error("Error pre-fetching featured games:", e));

    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.remove('active-view');
    });

    if (authSection) authSection.style.display = 'flex';
    if (mainAppSection) mainAppSection.style.display = 'none';
    if (expirationStatusDisplay) expirationStatusDisplay.style.display = 'none';
    if (pageBottomRightButtonContainer) pageBottomRightButtonContainer.style.display = 'none';


    if (libraryStatusMessage) libraryStatusMessage.style.display = 'none';
    if (gamelistStatusMessage) {
        gamelistStatusMessage.style.display = 'none';
    }
    if(libraryRefreshButton) libraryRefreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
});


// --- GameZoneQA Ultimate: extra sidebar wiring for merged modules ---
(function () {
    const map = [
        ['menuYouTubeMusicButton', 'youtubeMusicView'],
        ['menuDrmButton', 'drmView'],
        ['menuZonePlayButton', 'zonePlayView'],
        ['menuRetroPlayButton', 'retroPlayView'],
        ['menuWatchZoneButton', 'watchZoneView'],
        ['menuProductButton', 'productLibraryView'],
        ['menuGameLibButton', 'gameLibraryView'],
        ['menuSoftwareButton', 'softwareLibraryView'],
        ['menuWebsitesButton', 'websitesView'],
        ['menuHelpButton', 'helpView'],
        ['menuMarketplaceButton', 'marketplaceView'],
        ['menuReviewsButton', 'reviewsView'],
        ['menuContactButton', 'contactView'],
        ['menuLiveChatButton', 'liveChatView'],
    ];
    map.forEach(([btnId, viewId]) => {
        const btn = document.getElementById(btnId);
        const view = document.getElementById(viewId);
        if (btn && view && typeof switchView === 'function') {
            btn.addEventListener('click', () => switchView(view, btn));
        }
    });
})();

// --- Steam Library: Disable Steam (client) auto-update toggle via steam.cfg ---
(function () {
    const toggle = document.getElementById('steamCfgToggle');
    if (!toggle) return;

    async function refresh() {
        try {
            const res = await window.electronAPI.invoke('get-steam-cfg-state');
            if (res && res.success) { toggle.checked = !!res.enabled; toggle.disabled = false; }
            else { toggle.checked = false; toggle.disabled = true; }
        } catch (e) { toggle.disabled = true; }
    }

    toggle.addEventListener('change', async () => {
        const want = toggle.checked;
        toggle.disabled = true;
        try {
            const res = await window.electronAPI.invoke('set-steam-cfg-state', want);
            if (res && res.success) {
                toggle.checked = !!res.enabled;
                if (typeof addLog === 'function') addLog(res.message, 'success');
            } else {
                toggle.checked = !want; // revert on failure
                if (typeof addLog === 'function') addLog((res && res.message) || 'Failed to change Steam update setting.', 'error');
            }
        } catch (e) {
            toggle.checked = !want;
            if (typeof addLog === 'function') addLog('Failed to change Steam update setting.', 'error');
        } finally { toggle.disabled = false; }
    });

    const menuLibraryButton = document.getElementById('menuLibraryButton');
    if (menuLibraryButton) menuLibraryButton.addEventListener('click', refresh);
    refresh();
})();

// --- Live Chat Logic ---
function parseChatTimestamp(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const raw = String(value).trim();
    const isoLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)
        ? raw.replace(' ', 'T') + 'Z'
        : raw;
    const date = new Date(isoLike);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatChatTimestamp(value, includeDate = false) {
    const date = parseChatTimestamp(value);
    if (!date) return '';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const options = sameDay && !includeDate
        ? { hour: 'numeric', minute: '2-digit' }
        : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Intl.DateTimeFormat(undefined, options).format(date);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

async function loadChatHistory() {
    try {
        const response = await fetch(`${CHAT_SERVER_URL}/api/chat/messages/${chatUserCode}`);
        const data = await response.json();
        if (data.success && data.messages) {
            appChatMessages.innerHTML = '';
            data.messages.forEach(msg => {
                msg.is_admin = !!msg.is_admin;
                appendChatMessage(msg);
            });
            if (liveChatView && liveChatView.classList.contains('active-view')) {
                markClientChatRead();
            }
        }
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

function updateClientChatUnreadBadge(count = appChatUnreadCount) {
    appChatUnreadCount = Math.max(0, Number(count) || 0);
    if (!appChatUnreadBadge) return;
    appChatUnreadBadge.textContent = appChatUnreadCount > 99 ? '99+' : String(appChatUnreadCount);
    appChatUnreadBadge.style.display = appChatUnreadCount > 0 ? 'inline-flex' : 'none';
}

async function loadClientChatUnreadCount() {
    if (!CHAT_SERVER_URL || !chatUserCode) return;
    try {
        const response = await fetch(`${CHAT_SERVER_URL}/api/chat/unread/${encodeURIComponent(chatUserCode)}`);
        const data = await response.json();
        if (data.success) updateClientChatUnreadBadge(data.count);
    } catch (err) {
        console.warn('[LiveChat] unread count load failed:', err);
    }
}

async function markClientChatRead() {
    if (!CHAT_SERVER_URL || !chatUserCode) return;
    updateClientChatUnreadBadge(0);
    try {
        await fetch(`${CHAT_SERVER_URL}/api/chat/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viewer_code: chatUserCode, conversation_code: chatUserCode })
        });
    } catch (err) {
        console.warn('[LiveChat] read state save failed:', err);
    }
}

async function initLiveChat() {
    if (chatSocket) return; // Already initialized

    await ensureChatConfig();
    if (!window.io || !CHAT_SERVER_URL) { console.error('[LiveChat] config/Socket.IO not ready'); return; }

    // Connect to the chat backend (CHAT_SERVER_URL points at the VPS).
    chatSocket = io(CHAT_SERVER_URL);

    chatSocket.on('connect', () => {
        console.log('[LiveChat] connected');
        chatSocket.emit('join_chat', { code: chatUserCode, isAdmin: false });
        loadClientChatUnreadCount();
        loadChatHistory();
    });

    chatSocket.on('connect_error', (err) => {
        console.error('[LiveChat] connection error:', err && err.message);
    });

    chatSocket.on('disconnect', (reason) => {
        console.warn('[LiveChat] disconnected:', reason);
    });

    chatSocket.on('new_message', (msg) => {
        appendChatMessage(msg);
        if (msg.is_admin) {
            if (liveChatView && liveChatView.classList.contains('active-view')) {
                markClientChatRead();
            } else {
                updateClientChatUnreadBadge(appChatUnreadCount + 1);
            }
        }
    });

    chatSocket.on('user_typing', () => {
        chatTypingIndicator.innerText = "Admin is typing...";
    });

    chatSocket.on('user_stop_typing', () => {
        chatTypingIndicator.innerText = "";
    });

    appChatSendBtn.addEventListener('click', sendChatMessage);
    appChatTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    appChatAttachBtn.addEventListener('click', () => {
        appChatFileInput.click();
    });

    // File input selection event listener to show badge
    appChatFileInput.addEventListener('change', () => {
        const file = appChatFileInput.files[0];
        const badge = document.getElementById('chatAttachmentBadge');
        const nameEl = document.getElementById('chatAttachmentName');

        // Reject files of 100 MB or larger.
        if (file && file.size > MAX_UPLOAD_BYTES) {
            appChatFileInput.value = '';
            if (badge) badge.style.display = 'none';
            showUploadWarning(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB. The maximum upload size is 100 MB.`);
            return;
        }

        if (file && badge && nameEl) {
            nameEl.textContent = file.name;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }
    });

    // File selection cancellation
    const removeBtn = document.getElementById('chatAttachmentRemove');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            appChatFileInput.value = '';
            const badge = document.getElementById('chatAttachmentBadge');
            if (badge) badge.style.display = 'none';
        });
    }

    let typingTimeout;
    appChatTextInput.addEventListener('input', () => {
        chatSocket.emit('typing', { sender_code: chatUserCode, is_admin: false, target_code: 'admin_room' });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            chatSocket.emit('stop_typing', { sender_code: chatUserCode, is_admin: false, target_code: 'admin_room' });
        }, 2000);
    });
}

function getFileType(filename) {
    if (!filename) return 'other';
    const ext = filename.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'other';
}

// Normalize any stored attachment URL to the current chat server.
// Handles relative ("/uploads/..") and stale absolute ("http://127.0.0.1:3000/uploads/..") URLs.
function resolveFileUrl(url) {
    if (!url) return url;
    const idx = url.indexOf('/uploads/');
    if (idx !== -1) return CHAT_SERVER_URL + url.slice(idx);
    if (/^https?:\/\//i.test(url)) return url;
    return CHAT_SERVER_URL + (url.startsWith('/') ? '' : '/') + url;
}

// Strip the chat server's unique-id prefix from an uploaded file name.
// The server stores uploads as "{uniqueId}-{originalName}", e.g.
// "1783647344635-3768760.reya" -> we want to save it as "3768760.reya".
function cleanUploadFileName(nameOrUrl) {
    let base = String(nameOrUrl || '').split('?')[0].split('#')[0];
    base = base.substring(base.lastIndexOf('/') + 1);
    const cleaned = base.replace(/^\d+-/, '');
    return cleaned || base;
}

// Download a chat attachment through a blob so we control the saved filename
// (a plain external-open would save it with the server's uniqueId-prefixed name).
async function downloadChatAttachment(url, suggestedName, linkEl) {
    try {
        if (linkEl) { linkEl.style.pointerEvents = 'none'; linkEl.style.opacity = '0.6'; }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = suggestedName || cleanUploadFileName(url);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (e) {
        // Fallback: if the direct download fails, still let the user reach the file.
        console.error('Chat attachment download failed; opening externally.', e);
        window.electronAPI.send('open-external-url', url);
    } finally {
        if (linkEl) { linkEl.style.pointerEvents = ''; linkEl.style.opacity = ''; }
    }
}

function openChatFileViewer(url, type) {
    const modal = document.getElementById('chatFileViewerModal');
    const content = document.getElementById('chatFileViewerContent');
    const openBrowserBtn = document.getElementById('chatFileViewerOpenBrowser');
    if (!modal || !content) return;
    
    content.innerHTML = '';
    if (type === 'image') {
        content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 4px;">`;
    } else if (type === 'pdf') {
        content.innerHTML = `<iframe src="${url}" style="width: 80vw; height: 70vh; border: none; background: white;"></iframe>`;
    }
    
    openBrowserBtn.onclick = () => {
        window.electronAPI.send('open-external-url', url);
    };
    
    modal.style.display = 'flex';
}

// Max chat attachment size (100 MB).
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function showUploadWarning(message) {
    const modal = document.getElementById('uploadWarnModal');
    const txt = document.getElementById('uploadWarnText');
    if (!modal) {
        showCustomConfirm('Upload Blocked', message || 'File too large. Maximum upload size is 100 MB.', { confirmText: 'OK', hideCancel: true, danger: true });
        return;
    }
    if (txt && message) txt.textContent = message;
    modal.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('uploadWarnModal');
    const ok = document.getElementById('uploadWarnOk');
    if (ok && modal) ok.addEventListener('click', () => { modal.style.display = 'none'; });
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
});

// Exposed so other modules (e.g. "Avail Now" buttons) can post a chat message.
window.sendLiveChatMessage = function (text) {
    if (!text) return false;
    if (chatSocket && chatSocket.connected && chatUserCode) {
        chatSocket.emit('send_message', { sender_code: chatUserCode, message: text, file_url: null, file_name: null, is_admin: false });
        return true;
    }
    // Not connected yet — drop the text into the input so the user can send it.
    if (appChatTextInput) { appChatTextInput.value = text; appChatTextInput.focus(); }
    return false;
};

function sendChatMessage() {
    const text = appChatTextInput.value.trim();
    const files = appChatFileInput.files;
    
    if (!text && files.length === 0) return;

    if (files.length > 0) {
        // Backstop: reject files of 100 MB or larger.
        if (files[0].size > MAX_UPLOAD_BYTES) {
            appChatFileInput.value = '';
            const badge = document.getElementById('chatAttachmentBadge');
            if (badge) badge.style.display = 'none';
            showUploadWarning(`"${files[0].name}" is ${(files[0].size / 1048576).toFixed(1)} MB. The maximum upload size is 100 MB.`);
            return;
        }
        // Disable UI and show uploading state
        appChatTextInput.disabled = true;
        appChatAttachBtn.disabled = true;
        appChatSendBtn.disabled = true;
        const oldSendHtml = appChatSendBtn.innerHTML;
        appChatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const formData = new FormData();
        formData.append('file', files[0]);
        
        fetch(`${CHAT_SERVER_URL}/api/chat/upload`, {
            method: 'POST',
            body: formData
        }).then(res => res.json()).then(data => {
            if (data.success) {
                chatSocket.emit('send_message', {
                    sender_code: chatUserCode,
                    message: text,
                    file_url: CHAT_SERVER_URL + data.url,
                    file_name: data.name,
                    is_admin: false
                });
                appChatFileInput.value = '';
                appChatTextInput.value = '';
                const badge = document.getElementById('chatAttachmentBadge');
                if (badge) badge.style.display = 'none';
            }
        }).catch(err => {
            console.error("Upload error", err);
            showCustomConfirm('Upload Failed', 'Failed to upload attachment.', { confirmText: 'OK', hideCancel: true, danger: true });
        }).finally(() => {
            // Re-enable UI
            appChatTextInput.disabled = false;
            appChatAttachBtn.disabled = false;
            appChatSendBtn.disabled = false;
            appChatSendBtn.innerHTML = oldSendHtml;
        });
    } else {
        chatSocket.emit('send_message', {
            sender_code: chatUserCode,
            message: text,
            file_url: null,
            file_name: null,
            is_admin: false
        });
        appChatTextInput.value = '';
    }
}

function appendChatMessage(msg) {
    const div = document.createElement('div');
    div.className = `app-chat-message ${msg.is_admin ? 'admin' : 'user'}`;
    div.style.maxWidth = "70%";
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";
    div.style.marginBottom = "5px";
    
    if (msg.is_admin) {
        div.style.background = "#e63946";
        div.style.alignSelf = "flex-start";
        div.style.color = "white";
    } else {
        div.style.background = "#222226";
        div.style.alignSelf = "flex-end";
        div.style.border = "1px solid #2a2a2e";
    }

    let content = msg.message ? `<div>${escapeHtml(msg.message)}</div>` : '';
    if (msg.file_url) {
        const fileUrl = resolveFileUrl(msg.file_url);
        const fileType = getFileType(msg.file_name);
        if (fileType === 'image') {
            content += `<div style="margin-top:5px;"><img src="${fileUrl}" style="max-width:150px; max-height:150px; border-radius:4px; cursor:pointer; border:1px solid #333;" onclick="openChatFileViewer('${fileUrl}', 'image')"></div>`;
        } else if (fileType === 'pdf') {
            content += `<div style="margin-top:5px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; background:#1e1e24; border:1px solid #333; padding:6px 12px; border-radius:4px;" onclick="openChatFileViewer('${fileUrl}', 'pdf')"><i class="fas fa-file-pdf" style="color:#ff4757; font-size:1.2rem;"></i> <span style="text-decoration:underline; color:#00a8ff;">View PDF (${msg.file_name})</span></div>`;
        } else {
            // Non-viewable files (e.g. .reya): download with the uniqueId prefix stripped.
            const cleanName = cleanUploadFileName(msg.file_name || fileUrl);
            content += `<div style="margin-top:5px;"><a href="#" onclick="downloadChatAttachment('${fileUrl}', '${cleanName}', this); return false;" style="color:#00a8ff;text-decoration:underline;"><i class="fas fa-download"></i> ${cleanName}</a></div>`;
        }
    }
    const time = formatChatTimestamp(msg.timestamp);
    if (time) {
        content += `<div class="chat-message-time">${escapeHtml(time)}</div>`;
    }
    div.innerHTML = content;
    
    appChatMessages.appendChild(div);
    appChatMessages.scrollTop = appChatMessages.scrollHeight;
}

// --- Guest Custom Name Submission Handler ---
(function() {
    const setupNamePrompt = () => {
        const chatNameInput = document.getElementById('chatNameInput');
        const chatNameSubmitBtn = document.getElementById('chatNameSubmitBtn');
        
        if (chatNameSubmitBtn && chatNameInput) {
            chatNameSubmitBtn.addEventListener('click', () => {
                const name = chatNameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, ''); // sanitize name
                if (!name) {
                    showCustomConfirm('Invalid Name', 'Please enter a valid display name (letters, numbers, underscores or hyphens only).', { confirmText: 'OK', hideCancel: true, danger: true });
                    return;
                }
                if (name.length > 20) {
                    showCustomConfirm('Invalid Name', 'Name must be 20 characters or less.', { confirmText: 'OK', hideCancel: true, danger: true });
                    return;
                }
                localStorage.setItem('free_user_name', name);
                chatUserCode = 'free-' + name;
                
                const promptContainer = document.getElementById('chatNamePromptContainer');
                const mainWrapper = document.getElementById('chatMainWrapper');
                if (promptContainer) promptContainer.style.display = 'none';
                if (mainWrapper) mainWrapper.style.display = 'flex';
                
                initLiveChat();
            });

            chatNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    chatNameSubmitBtn.click();
                }
            });
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupNamePrompt);
    } else {
        setupNamePrompt();
    }
})();

// Close handler for Chat File Viewer Modal
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('chatFileViewerModal');
    const closeBtn = document.getElementById('chatFileViewerClose');
    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
});


// YouTube Music is hosted in a sandboxed Electron BrowserView above this page.
(function () {
    const host = document.getElementById('youtubeMusicHost');
    const back = document.getElementById('youtubeMusicBack');
    const forward = document.getElementById('youtubeMusicForward');
    const reload = document.getElementById('youtubeMusicReload');
    const playerPage = document.getElementById('youtubeMusicPlayerPageButton');
    const fullscreen = document.getElementById('youtubeMusicFullscreenButton');
    const dock = document.getElementById('youtubeMusicControlsDock');
    let active = false;
    if (!host) return;

    const sync = () => {
        const rect = host.getBoundingClientRect();
        const visible = active && mainAppSection && mainAppSection.style.display !== 'none';
        window.electronAPI.invoke('youtube-music-view', {
            visible,
            bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        }).catch((error) => console.warn('YouTube Music view update failed:', error.message));
    };
    window.youtubeMusicPage = { setActive(value) { active = !!value; sync(); } };
    const control = (action) => window.electronAPI.invoke('youtube-music-control', action).catch(() => {});
    if (back) back.addEventListener('click', () => control('back'));
    if (forward) forward.addEventListener('click', () => control('forward'));
    if (reload) reload.addEventListener('click', () => control('reload'));
    if (playerPage) playerPage.addEventListener('click', () => control('player-page'));
    if (fullscreen) fullscreen.addEventListener('click', () => control('fullscreen'));
    if (dock && window.electronAPI.on) window.electronAPI.on('youtube-music-inline-controls-state', (installed) => { dock.hidden = !!installed; });
    if (fullscreen && window.electronAPI.on) window.electronAPI.on('youtube-music-fullscreen-state', (isFullscreen) => {
        fullscreen.title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
        fullscreen.setAttribute('aria-label', fullscreen.title);
        fullscreen.innerHTML = isFullscreen
            ? '<svg class="enter-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5"/></svg>'
            : '<svg class="enter-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    });
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sync).observe(host);
    if (mainAppSection && typeof MutationObserver !== 'undefined') new MutationObserver(sync).observe(mainAppSection, { attributes: true, attributeFilter: ['style'] });
})();
