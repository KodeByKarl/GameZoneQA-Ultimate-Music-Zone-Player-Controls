// help.js — Help view: JSON-driven list of guides + in-app viewer modal.
//
// The guide list is hosted as a JSON file shaped like:
//   [ { "name": "...", "description": "...", "download_url": "<pdf OR video link, dl=1>" }, ... ]
// Add/remove guides by editing that file. Its link (and all media links) live in
// main.jsc and are served to the renderer via the help-get-items IPC handler.
// PDFs open in the embedded PDF viewer; videos stream in a <video> player.
(function () {
    const helpGrid = document.getElementById('helpGrid');
    const modal = document.getElementById('helpPdfModal');
    if (!helpGrid || !modal) return;
    const api = window.electronAPI;

    const frame = document.getElementById('helpPdfFrame');
    const video = document.getElementById('helpVideo');
    const image = document.getElementById('helpImage');
    const loading = document.getElementById('helpPdfLoading');
    const errorBox = document.getElementById('helpPdfError');
    const closeBtn = document.getElementById('helpPdfClose');
    const titleText = document.getElementById('pdfModalTitleText');
    const titleIcon = document.getElementById('pdfModalIcon');
    const searchInput = document.getElementById('helpSearch');
    let loadTimer = null;
    let allItems = [];

    const getUrl = (it) => it.download_url || it.download_pdf || it.url || it.pdf || it.video || '';
    const isVideo = (url) => /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi)$/i.test(String(url).split('?')[0]);
    const isImage = (url) => /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(String(url).split('?')[0]);
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function iconFor(it, url) {
        const t = (it.type || '').toLowerCase();
        if (t === 'video' || isVideo(url)) return 'fa-film';
        if (t === 'image' || t === 'picture' || isImage(url)) return 'fa-image';
        if (t === 'pdf' || /\.pdf$/i.test(String(url).split('?')[0])) return 'fa-file-pdf';
        return 'fa-file';
    }

    const clearTimer = () => { if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; } };
    const hideViewers = () => { frame.style.display = 'none'; try { video.pause(); } catch (e) {} video.style.display = 'none'; image.style.display = 'none'; };
    const showLoading = () => { loading.style.display = 'flex'; errorBox.style.display = 'none'; };
    const showError = () => { clearTimer(); loading.style.display = 'none'; errorBox.style.display = 'flex'; hideViewers(); };
    const reveal = () => { clearTimer(); loading.style.display = 'none'; errorBox.style.display = 'none'; };

    function closeModal() {
        modal.style.display = 'none';
        frame.src = 'about:blank'; frame.style.display = 'none';
        try { video.pause(); } catch (e) {}
        video.removeAttribute('src'); video.load(); video.style.display = 'none';
        image.removeAttribute('src'); image.style.display = 'none';
        clearTimer();
    }

    frame.addEventListener('load', () => { if (frame.style.display !== 'none' && frame.src && frame.src !== 'about:blank') reveal(); });
    video.addEventListener('loadeddata', () => { if (video.style.display !== 'none') reveal(); });
    video.addEventListener('error', () => { if (video.style.display !== 'none') showError(); });
    image.addEventListener('load', () => { if (image.style.display !== 'none') reveal(); });
    image.addEventListener('error', () => { if (image.style.display !== 'none') showError(); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // pdf vs video: explicit "type" wins, then file extension, then probe the
    // Content-Type via main (for extensionless API download links).
    // Kind = pdf | video | image. Explicit "type" wins, then file extension, then a
    // Content-Type probe via main (for extensionless API download links).
    async function resolveKind(url, type) {
        const t = (type || '').toLowerCase();
        if (t === 'video' || t === 'pdf' || t === 'image') return t;
        if (t === 'picture') return 'image';
        if (isVideo(url)) return 'video';
        if (isImage(url)) return 'image';
        if (/\.pdf$/i.test(String(url).split('?')[0])) return 'pdf';
        try { const r = await api.invoke('help-probe-url', url); if (r && r.kind && r.kind !== 'unknown') return r.kind; } catch (e) {}
        return 'pdf';
    }

    async function openMedia(name, url, type) {
        if (!url) return;
        if (titleText) titleText.textContent = name || 'Document';
        modal.style.display = 'flex';
        showLoading();

        const kind = await resolveKind(url, type);
        hideViewers();
        frame.src = 'about:blank';
        if (kind === 'video') {
            if (titleIcon) titleIcon.className = 'fas fa-film';
            video.style.display = 'block';
            video.src = url;          // stream directly
            video.load();
            clearTimer(); loadTimer = setTimeout(reveal, 25000);
        } else if (kind === 'image') {
            if (titleIcon) titleIcon.className = 'fas fa-image';
            image.style.display = 'block';
            image.src = url;          // load directly
            clearTimer(); loadTimer = setTimeout(reveal, 20000);
        } else {
            if (titleIcon) titleIcon.className = 'fas fa-file-pdf';
            frame.style.display = 'block';
            try {
                const res = await api.invoke('help-download-pdf', url);
                if (res && res.success && res.url) {
                    // Chromeless viewer: no toolbar, no thumbnail sidebar — just scroll.
                    frame.src = res.url + '#toolbar=0&navpanes=0&scrollbar=1&view=FitH';
                    clearTimer(); loadTimer = setTimeout(reveal, 20000);
                } else showError();
            } catch (e) { showError(); }
        }
    }

    function render(items) {
        if (!Array.isArray(items) || !items.length) {
            helpGrid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><i class="fas fa-inbox"></i><p>No guides available.</p></div>';
            return;
        }
        helpGrid.innerHTML = '';
        items.forEach((it) => {
            const url = getUrl(it);
            const name = it.name || it.title || 'Untitled';
            const icon = iconFor(it, url);
            const card = document.createElement('button');
            card.className = 'help-card';
            card.innerHTML =
                '<div class="help-icon"><i class="fas ' + icon + '"></i></div>' +
                '<div class="help-info"><span class="help-title">' + esc(name) + '</span>' +
                '<span class="help-sub">' + esc(it.description || '') + '</span></div>' +
                '<i class="fas fa-chevron-right help-arrow"></i>';
            if (url) card.addEventListener('click', () => openMedia(name, url, it.type));
            else card.disabled = true;
            helpGrid.appendChild(card);
        });
    }

    let activeCategory = 'guidelines';

    function applyFilter() {
        const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
        let filtered = allItems.filter((it) => (it.category || '').toLowerCase().trim() === activeCategory);

        if (term) {
            filtered = filtered.filter((it) => {
                const n = (it.name || it.title || '').toLowerCase();
                const d = (it.description || '').toLowerCase();
                return n.includes(term) || d.includes(term);
            });
        }

        if (!filtered.length) {
            const msg = term ? ('No guides match “' + esc(term) + '”.') : 'No guides in this category.';
            helpGrid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><i class="fas fa-magnifying-glass"></i><p>' + msg + '</p></div>';
        } else render(filtered);
    }
    if (searchInput) searchInput.addEventListener('input', applyFilter);

    // Category filter buttons (Windows / Steam OS / Others)
    const filterBar = document.getElementById('helpFilters');
    if (filterBar) {
        filterBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.help-filter');
            if (!btn) return;
            filterBar.querySelectorAll('.help-filter').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = (btn.dataset.category || 'all').toLowerCase();
            applyFilter();
        });
    }

    async function loadHelpItems() {
        helpGrid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><div class="loader"></div><p>Loading guides…</p></div>';
        try {
            const res = await api.invoke('help-get-items');
            allItems = (res && res.items) ? res.items : [];
        } catch (e) { allItems = []; }
        applyFilter();
    }

    loadHelpItems();
})();
