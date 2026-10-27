// softwarelib.js — Software Library module (merged from GameZoneQA Software)
(function () {
    const softwareGrid = document.getElementById('swGrid');
    if (!softwareGrid) return;
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);

    const statusMessage = $('swStatusMessage');
    const searchInput = $('swSearchInput');
    const downloadModal = $('swDownloadModal');
    const saveButton = $('swSaveBtn');
    const refreshBtn = $('swRefresh');

    let allSoftware = [];
    let selectedItem = null;
    let initialized = false;

    async function loadSoftware() {
        if (refreshBtn) refreshBtn.classList.add('spinning');
        showStatus('Loading software library...');
        try {
            const res = await api.invoke('sw-fetch-software');
            if (res && res.success) {
                allSoftware = res.data || [];
                if (allSoftware.length === 0) showStatus('The library is empty.', false);
                else { statusMessage.style.display = 'none'; filterSoftware(); }
            } else {
                console.error('[SoftwareLib] fetch failed:', res && res.error);
                showStatus('Failed to load data: ' + ((res && res.error) || 'unknown error'), false);
            }
        } catch (e) {
            console.error('[SoftwareLib] exception:', e);
            showStatus('Failed to load data: ' + e.message, false);
        }
        finally { if (refreshBtn) refreshBtn.classList.remove('spinning'); }
    }

    function showStatus(msg, loader = true) {
        softwareGrid.innerHTML = '';
        statusMessage.style.display = 'flex';
        statusMessage.innerHTML = loader ? `<div class="loader"></div><p>${msg}</p>` : `<p>${msg}</p>`;
    }

    function filterSoftware() {
        softwareGrid.innerHTML = '';
        const term = searchInput.value.toLowerCase();
        allSoftware.filter(item => item.title.toLowerCase().includes(term)).forEach(createCard);
    }

    function createCard(item) {
        const card = document.createElement('div');
        card.className = 'sw-card';
        const imgUrl = item.image && item.image.trim() !== '' ? item.image : 'udp.ico';
        card.innerHTML = `
            <div class="sw-card-image"><img src="${imgUrl}" loading="lazy" onerror="this.src='udp.ico'"></div>
            <div class="sw-card-info"><h3>${item.title}</h3></div>`;
        card.onclick = () => openModal(item);
        softwareGrid.appendChild(card);
    }

    function openModal(item) {
        selectedItem = item;
        $('swModalTitle').innerText = item.title;
        const descEl = $('swModalDesc');
        if (item.description && item.description.trim() !== '') { descEl.innerText = item.description; descEl.style.display = 'block'; }
        else descEl.style.display = 'none';
        saveButton.style.display = 'flex';
        saveButton.disabled = false;
        saveButton.innerHTML = `<i class="fas fa-download"></i> SAVE`;
        $('swProgressContainer').style.display = 'none';
        downloadModal.style.display = 'flex';
    }

    $('swModalClose').onclick = () => downloadModal.style.display = 'none';
    downloadModal.onclick = (e) => { if (e.target === downloadModal) downloadModal.style.display = 'none'; };

    saveButton.onclick = async () => {
        if (!selectedItem || !selectedItem.download_url) return;
        const cleanTitle = selectedItem.title.replace(/[/\\?%*:|"<>]/g, '').trim();
        const result = await api.invoke('sw-show-save-dialog', `${cleanTitle}.zip`);
        if (result.canceled || !result.filePath) return;
        saveButton.style.display = 'none';
        $('swProgressContainer').style.display = 'block';
        await api.invoke('sw-download-file', { url: selectedItem.download_url, savePath: result.filePath });
    };

    api.on('sw-download-progress', p => {
        const pct = Math.round(p.percent * 100);
        $('swProgressInner').style.width = pct + '%';
        $('swProgressText').innerText = `Downloading... ${pct}%`;
    });
    api.on('sw-download-status', s => {
        $('swProgressText').innerText = s.message;
        if (s.status === 'success') { saveButton.innerText = 'OPEN FOLDER'; setTimeout(() => downloadModal.style.display = 'none', 2000); }
        else if (s.status === 'error') { saveButton.style.display = 'flex'; saveButton.innerText = 'RETRY'; }
    });

    searchInput.oninput = filterSoftware;
    if (refreshBtn) refreshBtn.addEventListener('click', () => { initialized = true; loadSoftware(); });

    const menuBtn = document.getElementById('menuSoftwareButton');
    if (menuBtn) menuBtn.addEventListener('click', () => { if (!initialized) { initialized = true; loadSoftware(); } });
})();
