// gamelib.js — Switch Games module
// Switch games keep manual patching here. Bypass entries are exposed to Steam
// Library rows through GZGameLibraryPatchModal.
(function () {
    const gameGrid = document.getElementById('glGameGrid');
    if (!gameGrid) return;
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);

    const statusMessage = $('glStatusMessage');
    const searchInput = $('glSearchInput');
    const patchModal = $('glPatchModal');
    const gamePathInput = $('glPathInput');
    const patchButton = $('glPatchBtn');
    const autoPatchButton = $('glAutoPatchBtn');
    const patchButtons = $('glPatchButtons');
    const pathWarningText = $('glPathWarn');

    let allGames = [];
    let selectedPatchMode = 'fix';
    let selectedPatchAppId = null;
    let selectedPatchInstalled = false;
    let selectedGame = null;
    let initialized = false;

    async function loadSwitchGames() { showStatus('Loading Switch Games...'); handleResponse(await api.invoke('gl-fetch-switch-games'), 'No Switch games found.'); }

    function showStatus(msg, loader = true) {
        gameGrid.innerHTML = '';
        statusMessage.style.display = 'flex';
        statusMessage.innerHTML = loader ? `<div class="loader"></div><p>${msg}</p>` : `<p>${msg}</p>`;
    }

    function handleResponse(res, emptyMsg = 'The library is empty.') {
        if (res && res.success) {
            allGames = res.data || [];
            if (allGames.length === 0) showStatus(emptyMsg, false);
            else { statusMessage.style.display = 'none'; filterGames(); }
        } else showStatus('Error loading data.', false);
    }

    function filterGames() {
        gameGrid.innerHTML = '';
        const term = searchInput.value.toLowerCase();
        allGames.filter(g => g.title.toLowerCase().includes(term)).forEach(createCard);
    }

    function createCard(game) {
        const card = document.createElement('div');
        card.className = 'gl-card';
        const imgSrc = game.image || game.header_image || 'udp.ico';
        card.innerHTML = `<img src="${imgSrc}" loading="lazy" onerror="this.src='udp.ico'">`;
        card.onclick = () => openModal(game);
        gameGrid.appendChild(card);
    }

    function isSteamappsCommonPathRequired() {
        return selectedPatchMode === 'bypass' || selectedPatchMode === 'fix';
    }

    function setPatchButtonsVisible(visible) {
        if (patchButtons) patchButtons.style.display = visible ? 'flex' : 'none';
        else patchButton.style.display = visible ? 'flex' : 'none';
    }

    function openModal(game, options = {}) {
        selectedGame = game;
        selectedPatchMode = options.mode || 'switch';
        selectedPatchAppId = String(options.appId || game.appid || game.appId || '');
        selectedPatchInstalled = !!options.installed;
        $('glModalTitle').innerText = game.title;
        const descEl = $('glModalDesc');
        if (game.description && game.description.trim() !== '') { descEl.innerText = game.description.toUpperCase(); descEl.style.display = 'block'; }
        else descEl.style.display = 'none';
        gamePathInput.value = '';
        patchButton.disabled = true;
        patchButton.innerHTML = selectedPatchMode === 'bypass' ? '<i class="fas fa-folder-open"></i> MANUAL PATCH' : 'DOWNLOAD';
        setPatchButtonsVisible(true);
        if (autoPatchButton) {
            const canAutoPatch = selectedPatchMode === 'bypass' && /^\d+$/.test(selectedPatchAppId);
            autoPatchButton.style.display = canAutoPatch ? 'flex' : 'none';
            autoPatchButton.disabled = !canAutoPatch || !selectedPatchInstalled;
            autoPatchButton.innerHTML = '<i class="fas fa-bolt"></i> AUTO PATCH';
        }
        $('glProgressInner').style.width = '0%';
        $('glProgressText').innerText = '';
        $('glProgressContainer').style.display = 'none';
        if (isSteamappsCommonPathRequired()) { pathWarningText.innerText = 'The selected folder must be inside a `steamapps/common` directory.'; pathWarningText.style.color = 'var(--text-muted-color)'; }
        else { pathWarningText.innerText = 'Select the folder where you want to install/patch.'; pathWarningText.style.color = 'var(--success-color)'; }
        patchModal.style.display = 'flex';
    }

    $('glModalClose').onclick = () => patchModal.style.display = 'none';
    patchModal.onclick = (e) => { if (e.target === patchModal) patchModal.style.display = 'none'; };

    $('glBrowseBtn').onclick = async () => {
        const p = await api.invoke('gl-select-directory');
        if (!p) return;
        const normalized = p.replace(/\\/g, '/');
        let isValid = true;
        if (isSteamappsCommonPathRequired()) { if (!normalized.toLowerCase().includes('/steamapps/common')) isValid = false; }
        if (isValid) {
            gamePathInput.value = p;
            patchButton.disabled = false;
            pathWarningText.style.color = 'var(--text-muted-color)';
            pathWarningText.innerText = isSteamappsCommonPathRequired() ? 'The selected folder must be inside a `steamapps/common` directory.' : 'Select the folder where you want to install/patch.';
        } else {
            gamePathInput.value = 'ERR: Must be steamapps/common';
            patchButton.disabled = true;
            pathWarningText.style.color = 'var(--error-color)';
        }
    };

    async function runPatch(auto) {
        setPatchButtonsVisible(false);
        $('glProgressContainer').style.display = 'block';
        const channel = auto ? 'gl-auto-patch-game' : 'gl-patch-game';
        const payload = auto
            ? { url: selectedGame.download_url, appId: selectedPatchAppId }
            : { url: selectedGame.download_url, gamePath: gamePathInput.value };
        const result = await api.invoke(channel, payload);
        if (!result || !result.success) {
            $('glProgressText').innerText = result?.message || 'Patch failed.';
            setTimeout(() => setPatchButtonsVisible(true), 1200);
        }
    }

    patchButton.onclick = async () => {
        if (!selectedGame || patchButton.disabled) return;
        await runPatch(false);
    };

    if (autoPatchButton) {
        autoPatchButton.onclick = async () => {
            if (!selectedGame || autoPatchButton.disabled) return;
            await runPatch(true);
        };
    }

    api.on('gl-download-progress', p => {
        const pct = Math.round(p.percent * 100);
        $('glProgressInner').style.width = pct + '%';
        $('glProgressText').innerText = `Downloading... ${pct}%`;
    });
    api.on('gl-patch-status', s => {
        $('glProgressText').innerText = s.message;
        if (s.status === 'success') setTimeout(() => patchModal.style.display = 'none', 2500);
    });

    searchInput.oninput = filterGames;

    window.GZGameLibraryPatchModal = {
        open: openModal
    };

    const menuBtn = document.getElementById('menuGameLibButton');
    if (menuBtn) menuBtn.addEventListener('click', () => { if (!initialized) { initialized = true; loadSwitchGames(); } });
})();
