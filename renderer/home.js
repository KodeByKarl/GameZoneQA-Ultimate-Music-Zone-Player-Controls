// home.js — Home announcements (fetched from Dropbox) + external links for any
// [data-url] element (Contact cards, Discord CTA). Links open in the external
// default browser / mail app / dialer via shell.openExternal.
(function () {
    const api = window.electronAPI;

    // --- External links (Contact view, etc.) ---
    document.querySelectorAll('[data-url]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const url = el.getAttribute('data-url');
            if (url) api.invoke('app-open-external', url);
        });
    });

    // --- Announcements (URL lives in main.jsc, fetched via home-get-announcements) ---
    const box = document.getElementById('announcements');
    const refreshBtn = document.getElementById('annRefresh');
    if (!box) return;

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function setState(html) { box.innerHTML = `<div class="ann-state">${html}</div>`; }

    // Parse blocks separated by blank lines. Handles two formats:
    //   1) labelled:  "Date: (6/9/2026)" / "Message: ..."
    //   2) plain:     first line is the date "(6/9/2026)", rest is the message
    // Parentheses around the date are stripped; the date text is shown as-is.
    function parse(text) {
        const items = [];
        const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
        for (const raw of blocks) {
            const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length);
            if (!lines.length) continue;
            let date = '', message = '';
            const dateLine = lines.find((l) => /^date\s*:?/i.test(l));
            const msgLine = lines.find((l) => /^message\s*:?/i.test(l));
            if (dateLine || msgLine) {
                if (dateLine) date = dateLine.replace(/^date\s*:?\s*/i, '').trim();
                if (msgLine) message = lines.slice(lines.indexOf(msgLine)).join('\n').replace(/^message\s*:?\s*/i, '').trim();
            } else {
                date = lines[0];
                message = lines.slice(1).join('\n').trim();
            }
            date = date.replace(/^\((.*)\)$/, '$1').trim();
            if (date || message) items.push({ date, message });
        }
        return items;
    }

    function render(items) {
        if (!items.length) { setState('<i class="fas fa-inbox"></i><p>No announcements right now.</p>'); return; }
        box.innerHTML = items.map((it) => `
            <div class="ann-card">
                <div class="ann-badge"><i class="fas fa-calendar-day"></i> ${esc(it.date || '—')}</div>
                <div class="ann-message">${esc(it.message || '')}</div>
            </div>`).join('');
    }

    async function load() {
        setState('<div class="loader"></div><p>Loading announcements…</p>');
        if (refreshBtn) refreshBtn.classList.add('spinning');
        try {
            const res = await api.invoke('home-get-announcements');
            if (res && res.success) render(parse(res.text || ''));
            else setState('<i class="fas fa-triangle-exclamation"></i><p>Couldn\'t load announcements.</p>');
        } catch (e) {
            setState('<i class="fas fa-triangle-exclamation"></i><p>Couldn\'t load announcements.</p>');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    }

    if (refreshBtn) refreshBtn.addEventListener('click', load);
    load();
})();
