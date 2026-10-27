// steamcard.js — shared "Add to Steam" hover-overlay card builder.
// Used by both the Game Library (gamelib.js) and the DRM Unlocker (drm.js).
window.GZSteamCard = {
    build({ title, image, appid, onAdd }) {
        const card = document.createElement('div');
        card.className = 'gz-steam-card';

        const img = document.createElement('img');
        img.src = image || 'udp.ico';
        img.loading = 'lazy';
        img.onerror = () => { img.src = 'udp.ico'; };

        const overlay = document.createElement('div');
        overlay.className = 'gz-steam-overlay';

        const t = document.createElement('div');
        t.className = 'gz-steam-title';
        t.textContent = title || '';

        const btn = document.createElement('button');
        btn.className = 'gz-steam-add';
        if (appid) {
            btn.dataset.appid = String(appid);
            btn.innerHTML = '<i class="fas fa-plus"></i> Add to Steam';
            btn.addEventListener('click', (e) => { e.stopPropagation(); onAdd(String(appid), btn); });
        } else {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-ban"></i> No AppID';
        }

        overlay.appendChild(t);
        overlay.appendChild(btn);
        card.appendChild(img);
        card.appendChild(overlay);
        return card;
    },
    finish(btn, success) {
        if (success) { btn.innerHTML = '<i class="fas fa-check"></i> Added'; btn.classList.add('done'); }
        else { btn.innerHTML = '<i class="fas fa-times"></i> Failed'; btn.classList.add('failed'); }
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-plus"></i> Add to Steam';
            btn.classList.remove('done', 'failed');
            btn.disabled = false;
        }, 2500);
    }
};
