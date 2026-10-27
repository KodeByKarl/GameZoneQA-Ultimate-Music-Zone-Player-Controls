// contact.js — Contact & Community cards + Discord CTA, driven by a remote JSON.
//
// Edit the hosted JSON (CONTACT_JSON_URL) to change contacts WITHOUT rebuilding.
// Expected JSON shape:
//   {
//     "cards": [ { "label": "...", "value": "...", "url": "...", "icon": "globe" }, ... ],
//     "discord": { "title": "...", "subtitle": "...", "url": "...", "button": "Go to Server" }
//   }
// `icon` is a Font Awesome name (e.g. "globe", "envelope", "facebook"). Brand icons
// (facebook, whatsapp, discord, ...) are auto-detected; you may also pass a full class
// like "fas fa-gun".
(function () {
    const grid = document.getElementById('contactGrid');
    const discordBox = document.getElementById('contactDiscord');
    if (!grid) return;
    const api = window.electronAPI;

    // URL lives in compiled main; fetched by key.

    const BRANDS = ['facebook','whatsapp','discord','twitter','x-twitter','instagram','youtube','telegram','tiktok','github','linkedin','reddit','steam'];
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function iconClass(icon) {
        const v = String(icon || 'link').trim().toLowerCase();
        if (v.indexOf('fa-') !== -1) return /^[a-z0-9 -]+$/.test(v) ? v : 'fas fa-link';
        const name = v.replace(/^fa[bsr]?\s+/, '');
        return (BRANDS.indexOf(name) !== -1 ? 'fab fa-' : 'fas fa-') + (/^[a-z0-9-]+$/.test(name) ? name : 'link');
    }

    function openUrl(url) { if (url) api.invoke('app-open-external', url); }

    function renderCards(cards) {
        grid.innerHTML = '';
        (cards || []).forEach((c) => {
            const a = document.createElement('a');
            a.className = 'contact-card';
            a.innerHTML =
                '<div class="contact-icon"><i class="' + iconClass(c.icon) + '"></i></div>' +
                '<div class="contact-info"><span class="contact-label">' + esc(c.label) + '</span>' +
                '<span class="contact-value">' + esc(c.value) + '</span></div>' +
                '<i class="fas fa-arrow-up-right-from-square contact-arrow"></i>';
            a.addEventListener('click', (e) => { e.preventDefault(); openUrl(c.url); });
            grid.appendChild(a);
        });
    }

    function renderDiscord(d) {
        if (!discordBox) return;
        discordBox.innerHTML = '';
        if (!d || !d.url) return;
        const a = document.createElement('a');
        a.className = 'discord-cta';
        a.innerHTML =
            '<i class="fab fa-discord"></i>' +
            '<div class="discord-cta-text"><strong>' + esc(d.title || 'Join our Discord') + '</strong>' +
            '<span>' + esc(d.subtitle || '') + '</span></div>' +
            '<span class="discord-go">' + esc(d.button || 'Go to Server') + '</span>';
        a.addEventListener('click', (e) => { e.preventDefault(); openUrl(d.url); });
        discordBox.appendChild(a);
    }

    function renderAll(data) {
        const isArr = Array.isArray(data);
        renderCards(isArr ? data : (data.cards || []));
        renderDiscord(isArr ? null : data.discord);
    }

    async function load() {
        grid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><div class="loader"></div><p>Loading contacts…</p></div>';
        try {
            const res = await api.invoke('app-contact-data');
            if (!res || !res.success) throw new Error((res && res.error) || 'fetch failed');
            renderAll(res.data);
        } catch (e) {
            console.error('[Contact] load failed:', e && e.message);
            grid.textContent = 'Contact information is temporarily unavailable.';
        }
    }

    const viewport = document.getElementById('contactDistributorViewport');
    const track = document.getElementById('contactDistributorTrack');
    const group = document.getElementById('contactDistributorGroup');
    const status = document.getElementById('contactDistributorStatus');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let layoutScheduled = false;
    function updateDistributorLayout() {
        layoutScheduled = false;
        if (!viewport || !group) return;
        const moving = viewport.clientWidth > 0 && group.children.length > 1 && group.scrollWidth > viewport.clientWidth + 1 && !reducedMotion.matches;
        const clone = track.querySelector('[data-distributor-copy]');
        if (moving && !clone) {
            const copy = group.cloneNode(true);
            copy.removeAttribute('id');
            copy.dataset.distributorCopy = 'true';
            copy.setAttribute('aria-hidden', 'true');
            copy.querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
            track.appendChild(copy);
        } else if (!moving && clone) clone.remove();
        viewport.classList.toggle('is-moving', moving);
        const distance = group.scrollWidth + 16;
        track.style.setProperty('--distributor-distance', distance + 'px');
        track.style.setProperty('--distributor-duration', Math.max(15, distance / 30) + 's');
        if (moving) viewport.scrollLeft = 0;
    }
    function scheduleDistributorLayout() {
        if (!layoutScheduled) {
            layoutScheduled = true;
            queueMicrotask(updateDistributorLayout);
        }
    }
    async function loadDistributors() {
        if (!viewport || !group) return;
        try {
            const response = await api.invoke('app-distributors');
            if (!response?.success) throw new Error('Distributor feed unavailable');
            group.replaceChildren();
            for (const item of response.items || []) {
                const card = document.createElement('figure');
                card.className = 'contact-distributor-card';
                const portrait = document.createElement('div');
                portrait.className = 'contact-distributor-portrait';
                const initials = document.createElement('span');
                initials.textContent = item.name.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
                initials.setAttribute('aria-hidden', 'true');
                portrait.appendChild(initials);
                if (item.picture) {
                    const image = document.createElement('img');
                    image.setAttribute('aria-hidden', 'true');
                    image.referrerPolicy = 'no-referrer';
                    image.addEventListener('error', () => image.remove(), { once: true });
                    image.src = item.picture;
                    portrait.appendChild(image);
                }
                const name = document.createElement('figcaption');
                name.textContent = item.name;
                card.append(portrait, name);
                group.appendChild(card);
            }
            status.hidden = group.children.length > 0;
            status.textContent = 'No distributors available yet.';
            scheduleDistributorLayout();
        } catch (_) { status.textContent = 'Distributors are temporarily unavailable.'; }
    }
    if (viewport && group) {
        const observer = new ResizeObserver(scheduleDistributorLayout);
        observer.observe(viewport);
        observer.observe(group);
        reducedMotion.addEventListener('change', scheduleDistributorLayout);
    }
    load();
    loadDistributors();
})();
