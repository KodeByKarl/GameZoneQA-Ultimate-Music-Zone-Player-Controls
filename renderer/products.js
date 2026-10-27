// products.js — Contact view tabs (Products / Contact / Others) + the
// Products & Services list AND the Others list, both driven by remote JSON
// (edit without rebuilding). Both use the same card layout.
//
// Expected JSON shape (top-level `device` / `installation` are shared defaults
// that each entry may override; omit them entirely for Others if not relevant):
//   {
//     "device": "Laptop, PC, and handheld (...)",
//     "installation": "Self or Remote",
//     "products": [
//       {
//         "tier": "Bronze", "color": "#bfe3f5",
//         "app_name": "Manual Steam Injector", "os": "Windows OS",
//         "games": "120,000+ Steam Games",
//         "freebies": ["Unlimited Download"],
//         "note": "PROCESS FIRST BEFORE PAYMENT",
//         "badge": "BEST SELLER",
//         "price": 500, "app_needed": "Steam and Discord"
//       }
//     ]
//   }
(function () {
    const api = window.electronAPI;

    // Image preview modal helper (queried dynamically to avoid load-order issues)
    function openImagePreview(url) {
        const previewModal = document.getElementById('imagePreviewModal');
        const previewImg = document.getElementById('imagePreviewImg');
        const previewLoader = document.getElementById('imagePreviewLoader');
        const previewClose = document.getElementById('imagePreviewClose');

        if (!previewModal || !previewImg) return;
        previewModal.style.display = 'flex';
        if (previewLoader) previewLoader.style.display = 'flex';
        previewImg.style.opacity = '0';
        previewImg.src = url;
        
        previewImg.onload = () => {
            if (previewLoader) previewLoader.style.display = 'none';
            previewImg.style.opacity = '1';
        };
        
        previewImg.onerror = () => {
            if (previewLoader) previewLoader.style.display = 'none';
        };

        if (previewClose && !previewClose.dataset.previewWired) {
            previewClose.dataset.previewWired = 'true';
            previewClose.addEventListener('click', () => {
                previewModal.style.display = 'none';
                previewImg.src = '';
            });
        }
        if (!previewModal.dataset.previewWired) {
            previewModal.dataset.previewWired = 'true';
            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) {
                    previewModal.style.display = 'none';
                    previewImg.src = '';
                }
            });
        }
    }

    // URLs live in compiled main; fetched by key ('products' / 'others').

    // Fallback for Products (mirrors the current price sheet). Others has no
    // fallback data — it simply shows an empty state until its JSON loads.
    const PRODUCTS_FALLBACK = {
        device: 'Laptop, PC, and handheld (Steamdeck, Legion Go, Asus Rog Ally, MSI Claw etc.)',
        installation: 'Self or Remote',
        products: [
            { tier: 'Bronze', color: '#bfe3f5', app_name: 'Manual Steam Injector', os: 'Windows OS', games: '120,000+ Steam Games', freebies: ['Unlimited Download'], note: 'PROCESS FIRST BEFORE PAYMENT', price: 500, app_needed: 'Steam and Discord' },
            { tier: 'Bronze Plus', color: '#b5e0a0', app_name: 'Manual Steam Injector Premium', os: 'Windows OS', games: '120,000+ Steam Games', freebies: ['Lifetime Service Warranty (Unlimited download with lifetime assistance)', 'Windows Software', 'Android App/Games', 'Supported Online Games (selected games only)', 'Premium Games (Denuvo, EA, Ubisoft and Rockstar Social)'], price: 1000, app_needed: 'Steam and Discord' },
            { tier: 'Silver', color: '#2e9bd6', app_name: 'OneTap', os: 'Linux (Steam OS)', games: '120,000+ Steam Games', freebies: ['Lifetime Service Warranty (Unlimited download with lifetime assistance)', 'Lifetime Access to Windows Software, Android App/Games', 'Supported Online Games (selected games only) — for Windows OS only', 'Premium Games (Denuvo, EA, Ubisoft and Rockstar Social) — for Windows OS only'], price: 1000, app_needed: 'Steam' },
            { tier: 'Silver Plus', color: '#f4c19a', app_name: 'Nintendo Switch App', os: 'Linux, Mac and Windows OS', games: 'All Nintendo Switch Games', freebies: ['Unlimited Download', 'Lifetime Access to Windows Software, Android App/Games', 'Supported Online Games (selected games only)', 'Premium Games (Denuvo, EA, Ubisoft and Rockstar Social)'], price: 500, app_needed: 'N/A' },
            { tier: 'Gold', color: '#bdd7ee', app_name: 'Hammer App', os: 'Windows OS', games: '120,000+ Steam Games', freebies: ['Lifetime Service Warranty (Unlimited download with lifetime assistance)', 'Lifetime Access to Windows Software, Android App/Games', 'Supported Online Games (selected games only)'], badge: 'BEST SELLER', price: 1600, app_needed: 'Steam' },
            { tier: 'Gold Plus', color: '#e6a8e6', app_name: 'Hammer App and Nintendo Switch App', os: 'Linux, Mac and Windows OS', games: '120,000+ Steam Games and All Nintendo Switch Games', freebies: ['Lifetime Service Warranty (Unlimited download with lifetime assistance)', 'Lifetime Access to Windows Software, Android App/Games', 'Supported Online Games (selected games only)', 'Premium Games (Denuvo, EA, Ubisoft and Rockstar Social)', 'Nintendo Switch Games'], price: 2000, app_needed: 'Steam' }
        ]
    };

    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const peso = (p) => (p == null || p === '') ? '' : ('₱' + p);

    function metaRow(label, value) {
        if (!value) return '';
        return '<div class="product-meta-row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
    }

    function render(grid, data) {
        if (!grid) return;
        const device = data.device || '';
        const install = data.installation || '';
        const list = (data.products || data.items || []);
        if (!list.length) {
            grid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><i class="fas fa-inbox"></i><p>Nothing here yet.</p></div>';
            return;
        }
        grid.innerHTML = '';
        list.forEach((p) => {
            const card = document.createElement('div');
            card.className = 'product-card';
            if (p.color) card.style.setProperty('--tier-color', p.color);
            const freebies = (p.freebies || []).map((f) => '<li>' + esc(f) + '</li>').join('');
            card.innerHTML =
                '<div class="product-head">' +
                    '<div class="product-tier">' + esc(p.tier || p.name || '') +
                        (p.badge ? ' <span class="product-badge">' + esc(p.badge) + '</span>' : '') +
                    '</div>' +
                    '<div class="product-price">' + esc(peso(p.price)) + '</div>' +
                '</div>' +
                (p.app_name ? '<div class="product-app">' + esc(p.app_name) + '</div>' : '') +
                (p.banner_image ? 
                    '<div class="product-banner">' +
                        '<div class="product-banner-loader" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15);"><div class="loader" style="width: 24px; height: 24px; border-width: 2px;"></div></div>' +
                        '<img src="' + esc(p.banner_image) + '" style="opacity: 0; transition: opacity 0.25s ease;">' +
                    '</div>' : '') +
                (p.description ? '<div class="product-desc">' + esc(p.description) + '</div>' :
                '<div class="product-meta">' +
                    metaRow('OS', p.os) +
                    metaRow('Device', p.device || device) +
                    metaRow('Total Games', p.games) +
                    metaRow('App Needed', p.app_needed) +
                    metaRow('Installation', p.installation || install) +
                '</div>') +
                (freebies ? '<div class="product-freebies-title">Freebies</div><ul class="product-freebies">' + freebies + '</ul>' : '') +
                (p.note ? '<div class="product-note">' + esc(p.note) + '</div>' : '') +
                '<button class="product-avail" type="button"><i class="fas fa-bolt"></i> Avail Now</button>';

            const banner = card.querySelector('.product-banner');
            if (banner) {
                const img = banner.querySelector('img');
                const loader = banner.querySelector('.product-banner-loader');
                
                if (img.complete) {
                    if (loader) loader.style.display = 'none';
                    img.style.opacity = '1';
                } else {
                    img.onload = () => {
                        if (loader) loader.style.display = 'none';
                        img.style.opacity = '1';
                    };
                    img.onerror = () => {
                        if (loader) loader.style.display = 'none';
                    };
                }
                
                banner.addEventListener('click', () => {
                    openImagePreview(p.banner_image);
                });
            }

            const availBtn = card.querySelector('.product-avail');
            if (availBtn) availBtn.addEventListener('click', () => availProduct(p));
            grid.appendChild(card);
        });
    }

    // "Avail Now" → jump to Live Chat, auto-send the package details, show GCash QR.
    function availProduct(p) {
        let msg = 'Hi! I would like to avail the ' + (p.tier || p.name || '') + ' package';
        if (p.app_name) msg += ' (' + p.app_name + ')';
        if (p.price != null && p.price !== '') msg += ' — ₱' + p.price;
        msg += '. Please assist me with the payment. Thank you!';

        const menuBtn = document.getElementById('menuLiveChatButton');
        if (menuBtn) menuBtn.click();   // switch to the Live Chat view

        setTimeout(() => {
            if (typeof window.sendLiveChatMessage === 'function') window.sendLiveChatMessage(msg);
            if (typeof window.showPaymentQr === 'function') window.showPaymentQr();
        }, 350);
    }

    // Lazy loader factory (one fetch per grid, on first tab open).
    function makeLoader(gridId, endpointKey, fallback) {
        let loaded = false;
        return async function load() {
            const grid = document.getElementById(gridId);
            if (!grid || loaded) return;
            loaded = true;
            grid.innerHTML = '<div class="ann-state" style="grid-column:1/-1;"><div class="loader"></div><p>Loading…</p></div>';
            try {
                const res = await api.invoke('app-fetch-endpoint', endpointKey);
                if (!res || !res.success) throw new Error((res && res.error) || 'fetch failed');
                render(grid, JSON.parse(res.text));
            } catch (e) {
                console.error('[Products/Others] load failed:', e && e.message);
                render(grid, fallback || { products: [] });
            }
        };
    }

    const loadProducts = makeLoader('productGrid', 'products', PRODUCTS_FALLBACK);
    const loadOthers = makeLoader('othersGrid', 'others', { products: [] });

    // Tab switching
    const tabs = document.getElementById('ccTabs');
    if (tabs) {
        tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.cc-tab');
            if (!btn) return;
            tabs.querySelectorAll('.cc-tab').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('#marketplaceView .cc-panel').forEach((p) => p.classList.remove('active'));
            const panel = document.getElementById(btn.dataset.tab);
            if (panel) panel.classList.add('active');
            if (btn.dataset.tab === 'ccProducts') loadProducts();
            else if (btn.dataset.tab === 'ccOthers') loadOthers();
        });
    }

    // Load products on start since ccProducts is the active tab by default
    loadProducts();
})();
