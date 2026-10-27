// websites.js — Premium "Websites" list view, driven by a remote JSON.
//
// Expected JSON shape (array, or { "items": [...] }):
//   [
//     { "name": "Example", "description": "What it is", "link": "https://example.com" }
//   ]
(function () {
    const list = document.getElementById('webList');
    if (!list) return;
    const api = window.electronAPI;
    const statusEl = document.getElementById('webStatusMessage');
    const searchInput = document.getElementById('webSearchInput');
    const refreshBtn = document.getElementById('webRefresh');

    // URL lives in compiled main; fetched by key.
    let all = [];
    let loaded = false;
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function showStatus(msg, loader = true) {
        list.innerHTML = '';
        statusEl.style.display = 'flex';
        statusEl.innerHTML = loader ? '<div class="loader"></div><p>' + esc(msg) + '</p>' : '<p>' + esc(msg) + '</p>';
    }

    function render(items) {
        list.innerHTML = '';
        if (!items.length) { showStatus('No websites found.', false); return; }
        statusEl.style.display = 'none';
        items.forEach((w) => {
            const card = document.createElement('div');
            card.className = 'web-card';
            card.innerHTML =
                '<div class="web-icon"><i class="fas fa-globe"></i></div>' +
                '<div class="web-info">' +
                    '<span class="web-name">' + esc(w.name) + '</span>' +
                    (w.description ? '<span class="web-desc">' + esc(w.description) + '</span>' : '') +
                    (w.link ? '<span class="web-link">' + esc(w.link) + '</span>' : '') +
                '</div>' +
                '<i class="fas fa-arrow-up-right-from-square web-arrow"></i>';
            if (w.link) card.addEventListener('click', () => api.invoke('app-open-external', w.link));
            list.appendChild(card);
        });
    }

    function applyFilter() {
        const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
        if (!term) { render(all); return; }
        render(all.filter((w) =>
            (w.name || '').toLowerCase().includes(term) ||
            (w.description || '').toLowerCase().includes(term) ||
            (w.link || '').toLowerCase().includes(term)
        ));
    }

    async function load() {
        showStatus('Loading websites...');
        if (refreshBtn) refreshBtn.classList.add('spinning');
        try {
            const res = await api.invoke('app-fetch-endpoint', 'websites');
            if (!res || !res.success) throw new Error((res && res.error) || 'fetch failed');
            const data = JSON.parse(res.text);
            all = Array.isArray(data) ? data : (data.items || data.websites || []);
            applyFilter();
        } catch (e) {
            console.error('[Websites] load failed:', e && e.message);
            showStatus('Failed to load websites.', false);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    const menuBtn = document.getElementById('menuWebsitesButton');
    if (menuBtn) menuBtn.addEventListener('click', () => { if (!loaded) { loaded = true; load(); } });
})();
