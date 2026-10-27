// productlib.js — Product Library: category-filtered grid + save modal.
// Items come from main (product-get-items): { title, image, description, category,
// download_url(resolved|null) }. Downloads use product-download-file + the shared
// save dialog (sw-show-save-dialog).
(function () {
    const grid = document.getElementById('plGrid');
    if (!grid) return;
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);

    const status = $('plStatus');
    const searchInput = $('plSearch');
    const modal = $('plModal');
    const saveBtn = $('plSaveBtn');
    const navWrap = $('plNav');
    const refreshBtn = $('plRefresh');

    let allItems = [];
    let currentCat = 'Windows OS';
    let selected = null;
    let initialized = false;

    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    navWrap.querySelectorAll('.gl-nav-btn').forEach((b) => {
        b.addEventListener('click', () => {
            navWrap.querySelectorAll('.gl-nav-btn').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            currentCat = b.dataset.cat;
            filter();
        });
    });

    function showStatus(msg, loader = true) {
        grid.innerHTML = '';
        status.style.display = 'flex';
        status.innerHTML = loader ? `<div class="loader"></div><p>${msg}</p>` : `<p>${msg}</p>`;
    }

    async function load() {
        if (refreshBtn) refreshBtn.classList.add('spinning');
        showStatus('Loading products…');
        try {
            const res = await api.invoke('product-get-items');
            if (res && res.success) {
                allItems = res.items || [];
                filter();
            } else showStatus('Error loading products.', false);
        } catch (e) { showStatus('Error loading products.', false); }
        finally { if (refreshBtn) refreshBtn.classList.remove('spinning'); }
    }

    function filter() {
        grid.innerHTML = '';
        const term = searchInput.value.toLowerCase();
        const list = allItems.filter((p) => (currentCat === 'all' || p.category === currentCat) && (p.title || '').toLowerCase().includes(term));
        if (!list.length) {
            showStatus(currentCat === 'Android' ? 'No Android products yet.' : 'No products found.', false);
            return;
        }
        status.style.display = 'none';
        list.forEach(createCard);
    }

    function createCard(p) {
        const card = document.createElement('div');
        card.className = 'sw-card';
        const img = p.image || 'udp.ico';
        card.innerHTML =
            '<div class="sw-card-image"><img src="' + esc(img) + '" loading="lazy" onerror="this.src=\'udp.ico\'"></div>' +
            '<div class="sw-card-info"><h3>' + esc(p.title) + '</h3></div>';
        card.onclick = () => openModal(p);
        grid.appendChild(card);
    }

    function openModal(p) {
        selected = p;
        $('plModalTitle').innerText = p.title;
        const d = $('plModalDesc');
        if (p.description && p.description.trim()) { d.innerText = p.description; d.style.display = 'block'; }
        else d.style.display = 'none';
        $('plProgressContainer').style.display = 'none';
        saveBtn.style.display = 'flex';
        if (p.download_url) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-download"></i> SAVE'; }
        else { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-ban"></i> Unavailable'; }
        modal.style.display = 'flex';
    }

    $('plModalClose').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    saveBtn.onclick = async () => {
        if (!selected || !selected.download_url) return;
        const base = decodeURIComponent((selected.download_url.split('?')[0].split('/').pop()) || '').trim();
        const fileName = base || ((selected.title || 'product').replace(/[/\\?%*:|"<>]/g, '').trim() + '.zip');
        const result = await api.invoke('sw-show-save-dialog', fileName);
        if (result.canceled || !result.filePath) return;
        saveBtn.style.display = 'none';
        $('plProgressContainer').style.display = 'block';
        await api.invoke('product-download-file', { url: selected.download_url, savePath: result.filePath });
    };

    api.on('product-download-progress', (p) => {
        const pct = Math.round(p.percent * 100);
        $('plProgressInner').style.width = pct + '%';
        $('plProgressText').innerText = `Downloading… ${pct}%`;
    });
    api.on('product-download-status', (s) => {
        $('plProgressText').innerText = s.message;
        if (s.status === 'success') { setTimeout(() => modal.style.display = 'none', 2000); }
        else if (s.status === 'error') { saveBtn.style.display = 'flex'; saveBtn.innerHTML = '<i class="fas fa-download"></i> RETRY'; }
    });

    searchInput.oninput = filter;
    if (refreshBtn) refreshBtn.addEventListener('click', () => { initialized = true; load(); });

    const menuBtn = document.getElementById('menuProductButton');
    if (menuBtn) menuBtn.addEventListener('click', () => { if (!initialized) { initialized = true; load(); } });
})();
