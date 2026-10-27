// payment.js — GCash QR payment modal.
// Exposes window.showPaymentQr() and wires the chat "Payment" button.
(function () {
    const api = window.electronAPI;

    // QR image URLs live in compiled main; fetched once via app-get-config.
    let qrConfig = null;
    async function getQrConfig() {
        if (qrConfig) return qrConfig;
        try { qrConfig = await api.invoke('app-get-config'); } catch (e) { qrConfig = {}; }
        return qrConfig;
    }

    // Set an image src once, revealing it (and hiding its loader) when it loads.
    function setQr(img, url) {
        if (!img || !url || img.getAttribute('src')) return;
        const frame = img.closest('.qr-frame');
        const done = () => { if (frame) frame.classList.add('loaded'); };
        img.onload = done;
        img.onerror = done;   // hide the spinner even if the image fails
        img.src = url;
    }

    // Looked up at call time so DOM order (modal defined after this script) doesn't matter.
    window.showPaymentQr = async function () {
        const modal = document.getElementById('paymentQrModal');
        if (!modal) return;
        modal.style.display = 'flex';
        const cfg = await getQrConfig();   // lazy-load once
        setQr(document.getElementById('gcashQrImg'), cfg.paymentQr);
        setQr(document.getElementById('paypalQrImg'), cfg.paypalQr);
    };

    function init() {
        const modal = document.getElementById('paymentQrModal');
        const closeBtn = document.getElementById('paymentQrClose');
        const payBtn = document.getElementById('chatPaymentBtn');

        if (closeBtn && modal) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        if (payBtn) payBtn.addEventListener('click', () => window.showPaymentQr());
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
