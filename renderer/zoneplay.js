(function () {
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);

    const menuBtn = $('menuZonePlayButton');
    const grid = $('zonePlayGrid');
    if (!api || !grid) return;

    const search = $('zonePlaySearch');
    const refreshBtn = $('zonePlayRefresh');
    const status = $('zonePlayStatus');
    const scroller = $('zonePlayCategoryScroller');
    const prevBtn = $('zonePlayCategoryPrev');
    const nextBtn = $('zonePlayCategoryNext');
    const allTab = $('zonePlayAllTab');
    const installedTab = $('zonePlayInstalledTab');
    const modal = $('zonePlayModal');
    const modalClose = $('zonePlayModalClose');
    const modalImage = $('zonePlayModalImage');
    const modalTitle = $('zonePlayModalTitle');
    const modalDesc = $('zonePlayModalDesc');
    const pathInput = $('zonePlayPathInput');
    const browseBtn = $('zonePlayBrowseBtn');
    const startBtn = $('zonePlayStartBtn');
    const modalStatus = $('zonePlayModalStatus');
    const exeBlock = $('zonePlayExeBlock');
    const exeSelect = $('zonePlayExeSelect');
    const exeButton = $('zonePlayExeButton');
    const exeButtonText = $('zonePlayExeButtonText');
    const exeOptions = $('zonePlayExeOptions');
    const openFolderBtn = $('zonePlayOpenFolderBtn');
    const postButtons = $('zonePlayPostButtons');
    const primaryButtons = $('zonePlayPrimaryButtons');
    const desktopBtn = $('zonePlayDesktopBtn');
    const steamBtn = $('zonePlaySteamBtn');
    const pathBlock = $('zonePlayPathBlock');
    const progressInner = $('zonePlayProgressInner');
    const downloadText = $('zonePlayDownloadText');
    const etaText = $('zonePlayEtaText');
    const downloadBar = $('zonePlayDownloadBar');
    const pauseBtn = $('zonePlayPauseBtn');
    const resumeBtn = $('zonePlayResumeBtn');
    const stopBtn = $('zonePlayStopBtn');
    const storageModal = $('zonePlayStorageModal');
    const storageMessage = $('zonePlayStorageMessage');
    const storageRequired = $('zonePlayStorageRequired');
    const storageAvailable = $('zonePlayStorageAvailable');
    const storagePackage = $('zonePlayStoragePackage');
    const storageExtract = $('zonePlayStorageExtract');
    const storagePath = $('zonePlayStoragePath');
    const storageOk = $('zonePlayStorageOk');

    const DEFAULT_CATEGORIES = ['All', 'Action', 'Adventure', 'Indie', 'RPG', 'Casual', 'Simulation', 'Strategy', 'Racing', 'Sports'];

    let loaded = false;
    let allGames = [];
    let installs = {};
    let categories = [...DEFAULT_CATEGORIES];
    let currentCategory = 'All';
    let currentMode = 'all';
    let selectedGame = null;
    let selectedInstall = null;
    let selectedFolder = '';
    let selectedExePath = '';
    let activeTaskId = '';
    let downloadUiState = '';

    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    function decodeHtml(value) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = String(value || '');
        return textarea.value;
    }

    function installForGame(game) {
        const list = Object.values(installs || {});
        return list.find((item) => item.download_url === game.download_url) ||
            list.find((item) => String(item.title || '').toLowerCase() === String(game.title || '').toLowerCase()) ||
            null;
    }

    function visibleCategoriesForGame(game) {
        return (Array.isArray(game.category) ? game.category : [])
            .filter((cat) => cat && String(cat).trim().toLowerCase() !== 'hidden');
    }

    function showStatus(message, type = 'info', loader = false) {
        grid.innerHTML = '';
        status.style.display = 'block';
        status.className = `list-status-message ${type}`;
        status.innerHTML = loader ? `<div class="zoneplay-inline-loader"><div class="loader"></div><span>${esc(message)}</span></div>` : esc(message);
    }

    function setDownloadControls(state) {
        const downloading = state === 'downloading';
        const paused = state === 'paused';
        const extracting = state === 'extracting';
        pauseBtn.disabled = !downloading;
        resumeBtn.disabled = !paused;
        stopBtn.disabled = !(downloading || paused || extracting);
        downloadUiState = state || '';
    }

    function setDownloadBarVisible(visible) {
        if (downloadBar) downloadBar.style.display = visible ? 'flex' : 'none';
    }

    function setModalError(message) {
        modalStatus.textContent = message || '';
        modalStatus.style.display = message ? 'inline' : 'none';
    }

    function formatBytes(value) {
        const n = Number(value || 0);
        if (n < 1024) return `${n} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let size = n / 1024;
        let idx = 0;
        while (size >= 1024 && idx < units.length - 1) {
            size /= 1024;
            idx += 1;
        }
        return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[idx]}`;
    }

    function setProgressText(parts) {
        const pct = parts.percent || '--';
        const size = parts.size || '';
        const eta = parts.eta || '';
        etaText.innerHTML = `
            <span class="zp-progress-pct">${esc(pct)}</span>
            <span class="zp-progress-size">${esc(size)}</span>
            <span class="zp-progress-eta">${esc(eta)}</span>
        `;
    }

    function showStorageModal(storage, message) {
        if (!storageModal) {
            setModalError(message || 'Not enough storage for this download.');
            modal.style.display = 'flex';
            return;
        }
        storageMessage.textContent = message || 'Zone Play needs more free space before it can download and extract this game.';
        storageRequired.textContent = storage && storage.requiredText || '--';
        storageAvailable.textContent = storage && storage.freeText || '--';
        storagePackage.textContent = storage && storage.packageText || '--';
        storageExtract.textContent = storage && storage.extractText || '--';
        storagePath.textContent = storage && storage.folder ? `Save location: ${storage.folder}` : '';
        storageModal.style.display = 'flex';
    }

    function renderCategories() {
        scroller.innerHTML = '';
        categories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `gamelist-category-chip${cat === currentCategory ? ' active' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                currentCategory = cat;
                renderCategories();
                render();
            });
            scroller.appendChild(btn);
        });
    }

    function buildCategories() {
        const set = new Set(DEFAULT_CATEGORIES);
        allGames.forEach((game) => {
            visibleCategoriesForGame(game).forEach((cat) => {
                if (cat) set.add(cat);
            });
        });
        categories = Array.from(set);
    }

    function filteredGames() {
        const term = String(search.value || '').toLowerCase();
        return allGames.filter((game) => {
            const title = decodeHtml(game.title || '');
            const gameCategories = visibleCategoriesForGame(game);
            const inCategory = currentCategory === 'All' || gameCategories.includes(currentCategory);
            const matchesSearch = !term || title.toLowerCase().includes(term);
            const isInstalled = !!installForGame(game);
            return inCategory && matchesSearch && (currentMode === 'all' || isInstalled);
        });
    }

    function render() {
        const list = filteredGames();
        grid.innerHTML = '';
        if (!list.length) {
            const message = currentMode === 'installed' ? 'No installed Zone Play games found.' : 'No Zone Play games found.';
            showStatus(message, 'info', false);
            return;
        }
        status.style.display = 'none';
        list.forEach((game) => {
            const install = installForGame(game);
            const card = document.createElement('div');
            card.className = 'game-item zoneplay-card';
            const title = decodeHtml(game.title || 'Untitled');
            const img = game.image_url || game.hero_url || 'udp.ico';
            const visibleCats = visibleCategoriesForGame(game);
            const cats = visibleCats.length ? visibleCats.join(', ') : 'Uncategorized';
            card.innerHTML = `
                <div class="gamelist-thumb-wrap zoneplay-thumb">
                    <img src="${esc(img)}" loading="lazy" onerror="this.src='udp.ico'">
                    ${install ? `<div class="gamelist-thumb-badges">
                        <span class="gamelist-thumb-badge bypass">INSTALLED</span>
                    </div>` : ''}
                </div>
                <div class="game-info">
                    <h3 class="game-name">${esc(title)}</h3>
                    <p class="zoneplay-category-label">${esc(cats)}</p>
                </div>
                <div class="game-item-actions zoneplay-card-actions">
                    ${install ? `
                        <button class="game-item-button update-btn zoneplay-card-btn zoneplay-play-btn" aria-label="Play"><i class="fas fa-play"></i></button>
                        <button class="game-item-button update-btn zoneplay-card-btn zoneplay-manage-btn" aria-label="Manage"><i class="fas fa-folder-open"></i></button>
                        <button class="game-item-button update-btn zoneplay-card-btn zoneplay-delete-btn" aria-label="Delete"><i class="fas fa-trash"></i></button>
                    ` : `
                        <button class="game-item-button update-btn zoneplay-download-btn">
                            <i class="fas fa-download"></i> <span>Download</span>
                        </button>
                    `}
                </div>`;
            const downloadBtn = card.querySelector('.zoneplay-download-btn');
            if (downloadBtn) downloadBtn.addEventListener('click', () => openModal(game, install));
            const playBtn = card.querySelector('.zoneplay-play-btn');
            if (playBtn) playBtn.addEventListener('click', () => playInstall(install));
            const manageBtn = card.querySelector('.zoneplay-manage-btn');
            if (manageBtn) manageBtn.addEventListener('click', () => openModal(game, install));
            const deleteBtn = card.querySelector('.zoneplay-delete-btn');
            if (deleteBtn) deleteBtn.addEventListener('click', () => deleteInstall(install, title));
            grid.appendChild(card);
        });
    }

    async function load() {
        refreshBtn.classList.add('spinning');
        showStatus('Loading Zone Play catalog...', 'info', true);
        try {
            const result = await api.invoke('zp-fetch-games');
            if (!result || !result.success) throw new Error((result && result.message) || 'Failed to load Zone Play catalog.');
            allGames = (result.games || [])
                .map((game) => ({ ...game, title: decodeHtml(game.title || '') }))
                .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' }));
            installs = result.installs || {};
            buildCategories();
            renderCategories();
            render();
            loaded = true;
        } catch (err) {
            loaded = false;
            showStatus(err.message || 'Failed to load Zone Play catalog.', 'error', false);
        } finally {
            refreshBtn.classList.remove('spinning');
        }
    }

    function fillExeSelect(exes, preferredPath = '') {
        selectedExePath = '';
        exeSelect.dataset.value = '';
        exeButtonText.textContent = 'Select executable';
        exeOptions.innerHTML = '';
        const preferred = String(preferredPath || '').toLowerCase();
        let selectedIndex = 0;
        if (preferred) {
            const foundIndex = (exes || []).findIndex((exe) => String(exe.path || '').toLowerCase() === preferred);
            if (foundIndex >= 0) selectedIndex = foundIndex;
        }
        (exes || []).forEach((exe, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = `gamelist-sort-option zoneplay-exe-option${index === selectedIndex ? ' active' : ''}`;
            option.dataset.value = exe.path;
            option.textContent = exe.relativePath || exe.name || exe.path;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
            option.addEventListener('click', () => setSelectedExe(exe.path, option.textContent));
            exeOptions.appendChild(option);
            if (index === selectedIndex) setSelectedExe(exe.path, option.textContent, false);
        });
    }

    function setSelectedExe(path, label, close = true) {
        selectedExePath = path || '';
        exeSelect.dataset.value = selectedExePath;
        exeButtonText.textContent = label || 'Select executable';
        exeOptions.querySelectorAll('.zoneplay-exe-option').forEach((btn) => {
            const active = btn.dataset.value === selectedExePath;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (close) {
            exeSelect.classList.remove('open');
            exeButton.setAttribute('aria-expanded', 'false');
        }
    }

    function openModal(game, install) {
        selectedGame = game;
        selectedInstall = install || null;
        const title = decodeHtml(game.title || 'Zone Play');
        modalTitle.textContent = title;
        modalImage.src = game.hero_url || game.image_url || 'udp.ico';
        const visibleCats = visibleCategoriesForGame(game);
        modalDesc.textContent = visibleCats.length ? visibleCats.join(' / ') : 'Zone Play package';
        setModalError('');
        selectedFolder = '';
        pathInput.value = '';
        if (!activeTaskId) {
            progressInner.style.width = '0%';
            etaText.textContent = 'ETA --';
            downloadText.textContent = install ? `Installed: ${install.installDir || install.packagePath || title}` : 'Idle';
            setDownloadControls('');
        }

        if (install && Array.isArray(install.exeFiles) && install.exeFiles.length) {
            fillExeSelect(install.exeFiles, install.primaryExe || '');
            pathBlock.style.display = 'none';
            primaryButtons.style.display = 'none';
            exeBlock.style.display = 'block';
            postButtons.style.display = 'flex';
        } else {
            fillExeSelect([]);
            pathBlock.style.display = 'block';
            primaryButtons.style.display = 'flex';
            exeBlock.style.display = 'none';
            postButtons.style.display = 'none';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
        }
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    async function chooseFolder() {
        const folder = await api.invoke('zp-select-download-folder');
        if (!folder) return;
        selectedFolder = folder;
        pathInput.value = folder;
    }

    async function startDownload() {
        if (!selectedGame) return;
        if (!selectedFolder) {
            setModalError('Select a save location first.');
            return;
        }
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> DOWNLOADING';
        setModalError('');
        downloadText.textContent = `Resolving download link for ${selectedGame.title}...`;
        setDownloadBarVisible(true);
        setDownloadControls('');
        closeModal();
        api.invoke('zp-start-download', { game: selectedGame, folder: selectedFolder }).then((result) => {
            if (result && result.success) return;
            if (result && (result.stopped || result.status === 'stopped')) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
                setDownloadControls('');
                setDownloadBarVisible(false);
                activeTaskId = '';
                setModalError('');
                return;
            }
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> RETRY';
            setDownloadControls('');
            setDownloadBarVisible(false);
            activeTaskId = '';
            if (result && result.storage) {
                showStorageModal(result.storage, result.message);
                return;
            }
            setModalError((result && result.message) || 'Download failed.');
        }).catch((err) => {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> RETRY';
            setDownloadControls('');
            setDownloadBarVisible(false);
            activeTaskId = '';
            setModalError((err && err.message) || 'Download failed.');
        });
    }

    async function runPostAction(kind) {
        const exePath = selectedExePath || exeSelect.dataset.value || '';
        if (!exePath) {
            setModalError('Select an executable first.');
            return;
        }
        const title = selectedGame && selectedGame.title || modalTitle.textContent;
        const channel = kind === 'steam' ? 'zp-add-to-steam-offline' : 'zp-create-desktop-shortcut';
        const payload = {
            title,
            exePath,
            imageUrl: selectedGame && selectedGame.image_url || '',
            heroUrl: selectedGame && selectedGame.hero_url || '',
            installId: selectedInstall && selectedInstall.id || ''
        };
        setModalError('');
        const result = await api.invoke(channel, payload);
        if (!result || !result.success) setModalError(result && result.message ? result.message : 'Action failed.');
        else {
            if (result.install && result.install.id) {
                installs[result.install.id] = result.install;
                selectedInstall = result.install;
                render();
            }
            closeModal();
        }
    }

    function primaryExeForInstall(install) {
        if (!install) return '';
        if (install.primaryExe) return install.primaryExe;
        if (Array.isArray(install.exeFiles) && install.exeFiles.length) return install.exeFiles[0].path;
        return '';
    }

    async function playInstall(install) {
        const exePath = primaryExeForInstall(install);
        if (!exePath) {
            setModalError('No executable was found for this installed game.');
            return;
        }
        const result = await api.invoke('zp-launch-game', { exePath });
        if (!result || !result.success) {
            setModalError(result && result.message ? result.message : 'Game launch failed.');
            modal.style.display = 'flex';
        }
    }

    async function openInstallFolder() {
        const folderPath = selectedInstall && selectedInstall.installDir || '';
        if (!folderPath) {
            setModalError('Installed game folder was not found.');
            return;
        }
        const result = await api.invoke('zp-open-install-folder', { folderPath });
        if (!result || !result.success) {
            setModalError(result && result.message ? result.message : 'Could not open game folder.');
        }
    }

    async function deleteInstall(install, title) {
        if (!install || !install.id) return;
        const ok = typeof showCustomConfirm === 'function'
            ? await showCustomConfirm('Delete Zone Play Game', `Delete ${title} from Zone Play? This removes the extracted game folder.`, { confirmText: 'Delete', danger: true })
            : false;
        if (!ok) return;
        const result = await api.invoke('zp-delete-install', { id: install.id });
        if (result && result.success) {
            installs = result.installs || {};
            render();
            return;
        }
        setModalError(result && result.message ? result.message : 'Delete failed.');
        modal.style.display = 'flex';
    }

    api.on('zp-download-progress', (payload) => {
        if (!payload || (activeTaskId && payload.taskId !== activeTaskId)) return;
        if (downloadUiState === 'paused' || downloadUiState === 'stopped') return;
        if (payload.taskId) activeTaskId = payload.taskId;
        setDownloadBarVisible(true);
        const pct = Math.max(0, Math.min(100, Math.round((payload.percent || 0) * 100)));
        const isIndeterminate = !!payload.indeterminate;
        progressInner.classList.toggle('indeterminate', isIndeterminate);
        progressInner.style.width = isIndeterminate ? '45%' : `${pct}%`;
        if (payload.phase === 'extracting' && isIndeterminate) {
            setProgressText({ percent: 'Extracting', size: `${formatBytes(payload.transferred)} unpacked`, eta: '' });
            downloadText.textContent = 'Verifying files...';
        } else if (payload.phase === 'extracting') {
            setProgressText({ percent: `${pct}%`, size: `${formatBytes(payload.transferred)} / ${formatBytes(payload.total)}`, eta: '' });
            downloadText.textContent = 'Verifying files...';
        } else {
            if (payload.total) {
                setProgressText({
                    percent: `${pct}%`,
                    size: `${formatBytes(payload.transferred)} / ${formatBytes(payload.total)}`,
                    eta: `ETA ${payload.etaText || '--'}`
                });
            } else {
                setProgressText({ percent: '', size: formatBytes(payload.transferred), eta: '' });
            }
            downloadText.textContent = 'Downloading package...';
        }
    });

    api.on('zp-download-status', (payload) => {
        if (!payload) return;
        if (payload.taskId) activeTaskId = payload.taskId;
        downloadText.textContent = payload.message || 'Idle';
        if (payload.status === 'resolving') {
            setDownloadBarVisible(true);
            setDownloadControls('');
            progressInner.classList.add('indeterminate');
            progressInner.style.width = '45%';
            setProgressText({ percent: 'Resolving', size: '', eta: '' });
        }
        if (payload.status === 'downloading') {
            setDownloadBarVisible(true);
            setDownloadControls('downloading');
            progressInner.classList.remove('indeterminate');
        }
        if (payload.status === 'paused') {
            setDownloadBarVisible(true);
            setDownloadControls('paused');
            progressInner.classList.remove('indeterminate');
            downloadText.textContent = 'Download paused.';
        }
        if (payload.status === 'stopped') {
            setDownloadBarVisible(false);
            setDownloadControls('');
            progressInner.classList.remove('indeterminate');
            progressInner.style.width = '0%';
            setProgressText({ percent: '--', size: '', eta: '' });
            activeTaskId = '';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
            setModalError('');
        }
        if (payload.status === 'error') {
            setDownloadBarVisible(false);
            setDownloadControls('');
            progressInner.classList.remove('indeterminate');
            activeTaskId = '';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> RETRY';
            setModalError(payload.message || 'Download failed.');
        }
        if (payload.status === 'storage-error') {
            setDownloadBarVisible(false);
            setDownloadControls('');
            progressInner.classList.remove('indeterminate');
            activeTaskId = '';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> RETRY';
            showStorageModal(payload.storage, payload.message);
        }
        if (payload.status === 'extracting') {
            setDownloadBarVisible(true);
            setDownloadControls('extracting');
        }
        if (payload.status === 'complete') {
            setDownloadBarVisible(false);
            setDownloadControls('');
            progressInner.classList.remove('indeterminate');
            progressInner.style.width = '100%';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
            selectedInstall = payload.install || selectedInstall;
            if (payload.install) installs[payload.install.id] = payload.install;
            fillExeSelect(payload.exeFiles || []);
            pathBlock.style.display = 'none';
            primaryButtons.style.display = 'none';
            exeBlock.style.display = payload.exeFiles && payload.exeFiles.length ? 'block' : 'none';
            postButtons.style.display = payload.exeFiles && payload.exeFiles.length ? 'flex' : 'none';
            setModalError('');
            activeTaskId = '';
            render();
            if (payload.install && selectedGame) {
                openModal(selectedGame, payload.install);
            } else if (payload.install) {
                const game = allGames.find((item) =>
                    item.download_url === payload.install.download_url ||
                    String(item.title || '').toLowerCase() === String(payload.install.title || '').toLowerCase()
                ) || {
                    title: payload.install.title,
                    image_url: payload.install.image_url || '',
                    hero_url: payload.install.hero_url || '',
                    category: payload.install.category || [],
                    download_url: payload.install.download_url || ''
                };
                openModal(game, payload.install);
            }
        }
        if (payload.status === 'saved') {
            setDownloadBarVisible(false);
            setDownloadControls('');
            progressInner.classList.remove('indeterminate');
            activeTaskId = '';
            progressInner.style.width = '100%';
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
            closeModal();
        }
    });

    search.addEventListener('input', render);
    refreshBtn.addEventListener('click', load);
    browseBtn.addEventListener('click', chooseFolder);
    startBtn.addEventListener('click', startDownload);
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    exeButton.addEventListener('click', () => {
        const open = !exeSelect.classList.contains('open');
        exeSelect.classList.toggle('open', open);
        exeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (event) => {
        if (!exeSelect.contains(event.target)) {
            exeSelect.classList.remove('open');
            exeButton.setAttribute('aria-expanded', 'false');
        }
    });
    desktopBtn.addEventListener('click', () => runPostAction('desktop'));
    steamBtn.addEventListener('click', () => runPostAction('steam'));
    if (openFolderBtn) openFolderBtn.addEventListener('click', openInstallFolder);
    pauseBtn.addEventListener('click', () => {
        if (!activeTaskId) return;
        setDownloadControls('paused');
        progressInner.classList.remove('indeterminate');
        downloadText.textContent = 'Download paused.';
        api.invoke('zp-pause-download', activeTaskId);
    });
    resumeBtn.addEventListener('click', () => {
        if (!activeTaskId) return;
        setDownloadControls('downloading');
        downloadText.textContent = 'Download resumed.';
        api.invoke('zp-resume-download', activeTaskId);
    });
    stopBtn.addEventListener('click', () => {
        if (!activeTaskId) return;
        const taskId = activeTaskId;
        setDownloadControls('');
        setDownloadBarVisible(false);
        progressInner.classList.remove('indeterminate');
        progressInner.style.width = '0%';
        setProgressText({ percent: '--', size: '', eta: '' });
        downloadText.textContent = 'Idle';
        activeTaskId = '';
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-download"></i> DOWNLOAD';
        setModalError('');
        closeModal();
        api.invoke('zp-stop-download', taskId);
    });
    if (storageOk) storageOk.addEventListener('click', () => { storageModal.style.display = 'none'; });
    if (storageModal) storageModal.addEventListener('click', (event) => { if (event.target === storageModal) storageModal.style.display = 'none'; });
    prevBtn.addEventListener('click', () => scroller.scrollBy({ left: -220, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => scroller.scrollBy({ left: 220, behavior: 'smooth' }));

    renderCategories();

    [allTab, installedTab].forEach((btn) => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.mode;
            allTab.classList.toggle('active', currentMode === 'all');
            installedTab.classList.toggle('active', currentMode === 'installed');
            render();
        });
    });

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            setTimeout(() => { if (!loaded) load(); }, 0);
        });
    }
})();
