// drm.js — DRM Unlocker module (merged from GameZoneUnlocker)
// All channels are namespaced "drm-" and all controls are scoped to #drmView.
(function () {
    const drmView = document.getElementById('drmView');
    if (!drmView) return;
    const api = window.electronAPI;

    const $ = (id) => document.getElementById(id);

    const modeToggleBtns = drmView.querySelectorAll('#drmModeGroup .mode-toggle-btn');
    const steamVersionBtns = drmView.querySelectorAll('#drmSteamVersionGroup .mode-toggle-btn');

    const viewSteam = $('drm-view-steam');
    const viewUbisoft = $('drm-view-ubisoft');
    const viewEa = $('drm-view-ea');
    const viewDisableUpdate = $('drm-view-disable-update');
    const viewDrm = $('drm-view-drm');
    const pathSection = $('drmPathSection');
    const drmRight = drmView.querySelector('.drm-right');

    const steamBypassBtn = $('drmSteamBypassBtn');
    const dropZone = $('drmDropZone');
    const ubiDropZone = $('drmUbiDropZone');
    const eaDropZone = $('drmEaDropZone');
    const setSaveLocationButton = $('drmSelectBtn');
    const openFolderButton = $('drmOpenFolderBtn');
    const statusContent = $('drmStatusContent');
    const wubBtn = $('drmWubBtn');

    let isProcessing = false;
    let isSniffing = false;
    let currentMode = 'steam';
    let currentSteamVersion = '1';

    function addLog(msg, type = 'info') {
        if (!statusContent) return;
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        const d = new Date();
        const time = `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
        div.textContent = `${time} ${msg}`;
        statusContent.appendChild(div);
        statusContent.scrollTop = statusContent.scrollHeight;
    }

    function setDropState(zone, enabled) {
        if (!zone) return;
        zone.style.pointerEvents = enabled ? 'all' : 'none';
        zone.style.opacity = enabled ? '1' : '0.5';
    }

    function setControlsState(enabled) {
        drmView.querySelectorAll('button, select, input').forEach((b) => {
            if (!b.classList.contains('copy-btn-overlay')) b.disabled = !enabled;
        });
        setDropState(ubiDropZone, enabled);
        setDropState(eaDropZone, enabled);
        if (enabled) api.invoke('drm-get-location').then(checkPathValidity);
    }

    // --- Mode switching ---
    modeToggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            modeToggleBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;

            if (viewSteam) viewSteam.style.display = 'none';
            if (viewDrm) viewDrm.style.display = 'none';
            if (viewUbisoft) viewUbisoft.style.display = 'none';
            if (viewEa) viewEa.style.display = 'none';
            if (viewDisableUpdate) viewDisableUpdate.style.display = 'none';
            const noPath = (currentMode === 'disable-update' || currentMode === 'drm');
            if (pathSection) pathSection.style.display = noPath ? 'none' : '';

            if (currentMode === 'steam') { viewSteam.style.display = 'flex'; addLog('Mode set to: Denuvo (Steam)', 'info'); }
            else if (currentMode === 'drm') { viewDrm.style.display = 'flex'; addLog('Mode set to: DRM Games', 'info'); loadDrmGames(); }
            else if (currentMode === 'ubisoft') { viewUbisoft.style.display = 'flex'; addLog('Mode set to: Ubisoft', 'info'); }
            else if (currentMode === 'ea') { viewEa.style.display = 'flex'; addLog('Mode set to: EA Sports', 'info'); }
            else if (currentMode === 'disable-update') { viewDisableUpdate.style.display = 'flex'; addLog('Mode set to: Disable Update', 'info'); fetchDisableUpdateGames(); }
        });
    });

    // --- Disable Update list ---
    const disableUpdateList = $('drmDuList');
    const refreshDisableUpdateBtn = $('drmDuRefresh');
    const disableUpdateSearch = $('drmDuSearch');
    let isLoadingDisableUpdate = false;
    let disableUpdateGamesCache = [];

    function setDuListMessage(msg) { if (disableUpdateList) disableUpdateList.innerHTML = `<div class="du-empty">${msg}</div>`; }

    function renderDisableUpdateGames(games) {
        if (!disableUpdateList) return;
        disableUpdateList.innerHTML = '';
        if (!games || games.length === 0) { setDuListMessage('No installed library games found.'); return; }
        games.forEach((game) => {
            const row = document.createElement('div');
            row.className = 'du-row';
            const info = document.createElement('div');
            info.className = 'du-info';
            const name = document.createElement('span'); name.className = 'du-name'; name.textContent = game.name;
            const appid = document.createElement('span'); appid.className = 'du-appid'; appid.textContent = `AppID: ${game.appId}`;
            info.appendChild(name); info.appendChild(appid);
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = `du-toggle ${game.readOnly ? 'on' : 'off'}`;
            toggle.innerHTML = `<span class="du-toggle-text">${game.readOnly ? 'ON' : 'OFF'}</span>`;
            toggle.addEventListener('click', async () => {
                if (toggle.disabled) return;
                const disable = !toggle.classList.contains('on');
                toggle.disabled = true;
                try {
                    const res = await api.invoke('drm-set-disable-update', game.appId, disable);
                    if (res.success) {
                        game.readOnly = res.readOnly;
                        toggle.classList.toggle('on', res.readOnly);
                        toggle.classList.toggle('off', !res.readOnly);
                        toggle.querySelector('.du-toggle-text').textContent = res.readOnly ? 'ON' : 'OFF';
                        addLog(res.message, 'success');
                    } else addLog(res.message, 'error');
                } catch (e) { addLog('Failed to change update state.', 'error'); }
                finally { toggle.disabled = false; }
            });
            row.appendChild(info); row.appendChild(toggle);
            disableUpdateList.appendChild(row);
        });
    }

    function applyDisableUpdateFilter() {
        const term = (disableUpdateSearch ? disableUpdateSearch.value : '').trim().toLowerCase();
        if (!term) { renderDisableUpdateGames(disableUpdateGamesCache); return; }
        const filtered = disableUpdateGamesCache.filter((g) => g.name.toLowerCase().includes(term) || g.appId.includes(term));
        if (filtered.length === 0) setDuListMessage(`No games match "${term}".`);
        else renderDisableUpdateGames(filtered);
    }

    async function fetchDisableUpdateGames() {
        if (isLoadingDisableUpdate) return;
        isLoadingDisableUpdate = true;
        setDuListMessage('Loading installed games...');
        if (refreshDisableUpdateBtn) refreshDisableUpdateBtn.disabled = true;
        try {
            const res = await api.invoke('drm-get-disable-update-games');
            if (res.success) { disableUpdateGamesCache = res.games || []; applyDisableUpdateFilter(); }
            else { disableUpdateGamesCache = []; setDuListMessage(res.message || 'Failed to load games.'); }
        } catch (e) { disableUpdateGamesCache = []; setDuListMessage('Error loading games.'); }
        finally { isLoadingDisableUpdate = false; if (refreshDisableUpdateBtn) refreshDisableUpdateBtn.disabled = false; }
    }

    if (refreshDisableUpdateBtn) refreshDisableUpdateBtn.addEventListener('click', () => fetchDisableUpdateGames());
    if (disableUpdateSearch) disableUpdateSearch.addEventListener('input', () => applyDisableUpdateFilter());

    // --- Steam version switching ---
    steamVersionBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            steamVersionBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentSteamVersion = btn.dataset.version;
        });
    });

    // --- Path selection ---
    if (setSaveLocationButton) setSaveLocationButton.addEventListener('click', async () => {
        setControlsState(false);
        const mode = (currentMode === 'ea' || currentMode === 'ubisoft') ? 'exe' : 'folder';
        await api.invoke('drm-select-location', mode);
        setControlsState(true);
    });
    if (openFolderButton) openFolderButton.addEventListener('click', () => api.invoke('drm-open-game-folder'));

    function checkPathValidity(info) {
        const input = $('drmPathInput');
        if (info && (info.isValid || info.displayString === '')) input.value = info.displayString || 'No valid location set.';
        const isValid = info && info.isValid && !isProcessing;
        if (steamBypassBtn) steamBypassBtn.disabled = !isValid;
        ['drmEaBypassBtn', 'drmEaPlayBtn', 'drmUbiBypassBtn', 'drmUbiPlayBtn'].forEach((id) => { const el = $(id); if (el) el.disabled = !isValid; });
        [ubiDropZone, eaDropZone].forEach((z) => { if (z) { z.style.opacity = isValid ? '1' : '0.5'; z.style.pointerEvents = isValid ? 'all' : 'none'; z.style.cursor = isValid ? 'pointer' : 'not-allowed'; } });
        if (openFolderButton) openFolderButton.disabled = !(info && info.isValid);
    }

    // --- Patching ---
    async function executeBypass(mode, selection) {
        isProcessing = true;
        setControlsState(false);
        try {
            const res = await api.invoke('drm-start-bypass', { mode, selection });
            addLog(res.message, res.success ? 'success' : 'error');
        } catch (e) { addLog('Operation failed.', 'error'); }
        finally { isProcessing = false; setControlsState(true); }
    }

    if (steamBypassBtn) steamBypassBtn.addEventListener('click', () => executeBypass('steam', currentSteamVersion));
    const eaBypassBtn = $('drmEaBypassBtn');
    if (eaBypassBtn) eaBypassBtn.addEventListener('click', () => executeBypass('ea', $('drmEaGameSelect').value));
    const ubiBypassBtn = $('drmUbiBypassBtn');
    if (ubiBypassBtn) ubiBypassBtn.addEventListener('click', () => executeBypass('ubisoft', 'ubisoft'));

    // --- Generator (sniffer) ---
    async function handleGenerateClick(btnId, logId, downloadBtnId, mode) {
        const btn = $(btnId); const logArea = $(logId); const dlBtn = $(downloadBtnId);
        if (isSniffing) {
            isSniffing = false;
            btn.innerHTML = '<i class="fas fa-play"></i><span>Generate</span>';
            btn.classList.remove('stopped');
            addLog('Monitor stopped by user.', 'info');
            return;
        }
        isSniffing = true;
        btn.innerHTML = '<i class="fas fa-stop"></i><span>Stop</span>';
        btn.classList.add('stopped');
        logArea.value = '';
        dlBtn.disabled = true;
        const res = await api.invoke('drm-launch-game-process', mode);
        if (!res.success) {
            addLog(res.message, 'error');
            isSniffing = false;
            btn.innerHTML = '<i class="fas fa-play"></i><span>Generate</span>';
            btn.classList.remove('stopped');
        }
    }
    const eaPlayBtn = $('drmEaPlayBtn');
    if (eaPlayBtn) eaPlayBtn.addEventListener('click', () => handleGenerateClick('drmEaPlayBtn', 'drmEaLogText', 'drmEaDownloadBtn', 'ea'));
    const ubiPlayBtn = $('drmUbiPlayBtn');
    if (ubiPlayBtn) ubiPlayBtn.addEventListener('click', () => handleGenerateClick('drmUbiPlayBtn', 'drmUbiLogText', 'drmUbiDownloadBtn', 'ubisoft'));

    api.on('drm-ticket-found', (content) => {
        if (!isSniffing) return;
        if (currentMode === 'ea') {
            $('drmEaLogText').value = content;
            $('drmEaDownloadBtn').disabled = false;
            const btn = $('drmEaPlayBtn'); btn.innerHTML = '<i class="fas fa-play"></i><span>Generate</span>'; btn.classList.remove('stopped');
        } else if (currentMode === 'ubisoft') {
            $('drmUbiLogText').value = content;
            $('drmUbiDownloadBtn').disabled = false;
            const btn = $('drmUbiPlayBtn'); btn.innerHTML = '<i class="fas fa-play"></i><span>Generate</span>'; btn.classList.remove('stopped');
        }
        addLog('Token/Ticket data captured successfully.', 'success');
        isSniffing = false;
    });

    // --- Save & copy ---
    async function handleDownload(logId) {
        const content = $(logId).value;
        if (!content) return;
        const res = await api.invoke('drm-save-and-open-token', content);
        if (res.success) addLog('Ticket saved and opened.', 'success'); else addLog(res.message, 'error');
    }
    const eaDownloadBtn = $('drmEaDownloadBtn');
    if (eaDownloadBtn) eaDownloadBtn.addEventListener('click', () => handleDownload('drmEaLogText'));
    const ubiDownloadBtn = $('drmUbiDownloadBtn');
    if (ubiDownloadBtn) ubiDownloadBtn.addEventListener('click', () => handleDownload('drmUbiLogText'));

    function copyToClipboard(elementId) {
        const el = $(elementId);
        if (!el) return;
        el.select();
        document.execCommand('copy');
        addLog('Data copied to clipboard.', 'info');
    }
    const eaCopyBtn = $('drmEaCopyBtn');
    if (eaCopyBtn) eaCopyBtn.addEventListener('click', () => copyToClipboard('drmEaLogText'));
    const ubiCopyBtn = $('drmUbiCopyBtn');
    if (ubiCopyBtn) ubiCopyBtn.addEventListener('click', () => copyToClipboard('drmUbiLogText'));

    // --- Drag & drop helpers ---
    function wireDropZone(zone, channel) {
        if (!zone) return;
        zone.addEventListener('click', async () => {
            if (isProcessing) return;
            addLog('Waiting for .reya or .zip selection...', 'info');
            const res = await api.invoke(channel, null);
            addLog(res.message, res.success ? 'success' : 'error');
        });
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                const lowerName = file.name.toLowerCase();
                if (!lowerName.endsWith('.reya') && !lowerName.endsWith('.zip')) {
                    addLog('Invalid file format. Drop a .reya or .zip file.', 'error');
                    return;
                }
                addLog(`Processing ${file.name}...`, 'info');
                const res = await api.invoke(channel, file.path);
                addLog(res.message, res.success ? 'success' : 'error');
            }
        });
    }
    wireDropZone(dropZone, 'drm-process-reya-file');
    wireDropZone(ubiDropZone, 'drm-process-ubisoft-reya');
    wireDropZone(eaDropZone, 'drm-process-ea-reya');

    // --- Windows Disabler ---
    async function updateWubButton() {
        if (!wubBtn) return;
        wubBtn.style.opacity = '0.5';
        wubBtn.style.pointerEvents = 'none';
        try {
            const res = await api.invoke('drm-get-wub-status');
            wubBtn.style.opacity = '1';
            wubBtn.style.pointerEvents = 'all';
            const icon = wubBtn.querySelector('i');
            const span = wubBtn.querySelector('span');
            if (res.status === 'disabled') {
                wubBtn.dataset.state = 'disabled';
                icon.className = 'fas fa-shield-alt';
                wubBtn.classList.remove('wub-active'); wubBtn.classList.add('wub-blocked');
                span.textContent = 'Windows Updates Blocked';
            } else {
                wubBtn.dataset.state = 'enabled';
                icon.className = 'fas fa-shield-virus';
                wubBtn.classList.remove('wub-blocked'); wubBtn.classList.add('wub-active');
                span.textContent = 'Windows Updates Active';
            }
        } catch (e) { addLog('Failed to check WUB status', 'error'); }
    }
    if (wubBtn) {
        updateWubButton();
        wubBtn.addEventListener('click', async () => {
            const action = (wubBtn.dataset.state === 'disabled') ? 'enable' : 'disable';
            addLog(`Applying Windows Update settings (${action})...`, 'info');
            const res = await api.invoke('drm-set-wub-state', action);
            if (res.success) { addLog(res.message, 'success'); await updateWubButton(); }
            else addLog(res.message, 'error');
        });
    }

    // --- DRM Games browser (moved from Game Library) ---
    const drmGamesGrid = $('drmGamesGrid');
    const drmGamesStatus = $('drmGamesStatus');
    const drmGamesSearch = $('drmGamesSearch');
    let drmGamesCache = [];
    let drmGamesLoaded = false;
    const drmPending = new Map();
    const drmGetAppId = (g) => g.appid || g.app_id || g.appId || g.steam_appid || g.AppID || null;

    function drmGamesShowStatus(msg, loader = true) {
        if (drmGamesGrid) drmGamesGrid.innerHTML = '';
        if (!drmGamesStatus) return;
        drmGamesStatus.style.display = 'flex';
        drmGamesStatus.innerHTML = loader ? `<div class="loader"></div><p>${msg}</p>` : `<p>${msg}</p>`;
    }
    function renderDrmGames() {
        if (!drmGamesGrid) return;
        drmGamesGrid.innerHTML = '';
        const term = (drmGamesSearch ? drmGamesSearch.value : '').toLowerCase();
        const list = drmGamesCache.filter((g) => (g.title || '').toLowerCase().includes(term));
        if (list.length === 0) { drmGamesShowStatus('No games found.', false); return; }
        if (drmGamesStatus) drmGamesStatus.style.display = 'none';
        list.forEach((game) => {
            const card = window.GZSteamCard.build({
                title: game.title,
                image: game.image || game.header_image,
                appid: drmGetAppId(game),
                onAdd: (id, btn) => {
                    btn.disabled = true;
                    btn.classList.remove('done', 'failed');
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                    drmPending.set(id, btn);
                    addLog(`Adding ${game.title} (AppID ${id}) to Steam library...`, 'info');
                    api.send('process-appid', id, true, true);
                }
            });
            drmGamesGrid.appendChild(card);
        });
    }
    async function loadDrmGames() {
        if (drmGamesLoaded) { renderDrmGames(); return; }
        drmGamesShowStatus('Loading DRM games...');
        const res = await api.invoke('gl-fetch-drm-games');
        if (res && res.success) { drmGamesCache = res.data || []; drmGamesLoaded = true; renderDrmGames(); }
        else drmGamesShowStatus('Error loading DRM games.', false);
    }
    if (drmGamesSearch) drmGamesSearch.addEventListener('input', renderDrmGames);
    api.on('gamelist-item-process-complete', ({ appId, success }) => {
        const btn = drmPending.get(String(appId));
        if (!btn) return;
        drmPending.delete(String(appId));
        window.GZSteamCard.finish(btn, success);
        addLog(success ? `AppID ${appId} added to Steam successfully.` : `Failed to add AppID ${appId} to Steam.`, success ? 'success' : 'error');
    });

    api.on('drm-status-update', (msg, type) => addLog(msg, type));
    api.on('drm-current-path', checkPathValidity);

    api.invoke('drm-get-location').then(checkPathValidity);
    addLog('GameZoneQA DRM Unlocker initialized.', 'success');
})();
