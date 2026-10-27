// chathelp.js — Collapsible "Do you need help?" panel above the live-chat input.
// Content is driven by a remote JSON (edit without rebuilding).
//
// Expected JSON shape:
//   {
//     "title": "Do you need help?",
//     "items": [
//       { "title": "Activation Issues", "body": "If you need a .reya file ..." },
//       { "title": "Technical Support", "body": "If you have any problems ..." }
//     ]
//   }
(function () {
    const wrap = document.getElementById('chatHelpWrap');
    const toggle = document.getElementById('chatHelpToggle');
    const panel = document.getElementById('chatHelpPanel');
    const titleEl = document.getElementById('chatHelpTitle');
    if (!wrap || !toggle || !panel) return;
    const api = window.electronAPI;

    // URL lives in compiled main; fetched by key.
    const FALLBACK = {
        title: 'Do you need help?',
        items: [
            { title: 'Activation Issues', body: 'If you need a .reya file to activate your DRM-protected game, please submit the required photo.' },
            { title: 'Technical Support', body: 'If you have any problems with your game or Steam, please visit the Help category for tutorials and guides.' },
            { title: 'Avail a Product', body: 'Submit us your payment receipt, and our admin will confirm your payment shortly.' }
        ]
    };

    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let loaded = false;

    function render(data) {
        if (titleEl && data.title) titleEl.textContent = data.title;
        const items = (data && data.items) || [];
        if (!items.length) {
            panel.innerHTML = '<p class="chat-help-empty">No help topics available.</p>';
            return;
        }
        panel.innerHTML = items.map((it) =>
            '<div class="chat-help-item"><h4>' + esc(it.title) + '</h4><p>' + esc(it.body) + '</p></div>'
        ).join('');
    }

    async function load() {
        if (loaded) return;
        loaded = true;
        try {
            const res = await api.invoke('app-fetch-endpoint', 'chatHelp');
            if (!res || !res.success) throw new Error((res && res.error) || 'fetch failed');
            render(JSON.parse(res.text));
        } catch (e) {
            console.error('[ChatHelp] load failed, using fallback:', e && e.message);
            render(FALLBACK);
        }
    }

    toggle.addEventListener('click', () => {
        wrap.classList.toggle('open');
    });

    // Preload the help content when the user opens the Live Chat view,
    // so it's ready before they expand the panel.
    const liveChatMenuBtn = document.getElementById('menuLiveChatButton');
    if (liveChatMenuBtn) liveChatMenuBtn.addEventListener('click', load);
})();
