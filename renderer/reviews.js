// reviews.js — Reviews view driven by a remote JSON.
//
// Expected JSON shape:
//   {
//     "reviews": [
//       { "name": "John Doe", "stars": 5, "banner_image": "...", "description": "..." }
//     ]
//   }
(function () {
    const api = window.electronAPI;
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;

    const statusEl = document.getElementById('reviewsStatusMessage');
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function showStatus(msg, loader = true) {
        grid.innerHTML = '';
        statusEl.style.display = 'flex';
        statusEl.innerHTML = loader ? '<div class="loader"></div><p>' + esc(msg) + '</p>' : '<p>' + esc(msg) + '</p>';
    }

    function render(items) {
        grid.innerHTML = '';
        statusEl.style.display = 'none';
        if (!items || !items.length) { showStatus('No reviews yet.', false); return; }
        
        items.forEach((r) => {
            const card = document.createElement('div');
            card.className = 'review-card';
            
            // Build stars HTML (up to 5)
            const numStars = Math.max(0, Math.min(5, parseInt(r.stars) || 0));
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                if (i < numStars) {
                    starsHtml += '<i class="fas fa-star" style="color: #fbbf24; margin-right: 2px;"></i>';
                } else {
                    starsHtml += '<i class="far fa-star" style="color: #4b5563; margin-right: 2px;"></i>';
                }
            }

            card.innerHTML =
                '<div class="review-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
                    '<span class="review-name" style="font-size: 15px; font-weight: 800; color: var(--text-color);">' + esc(r.name) + '</span>' +
                    '<div class="review-stars" style="display: flex; align-items: center;">' + starsHtml + '</div>' +
                '</div>' +
                (r.banner_image ? 
                    '<div class="product-banner">' +
                        '<div class="product-banner-loader" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.15);"><div class="loader" style="width: 24px; height: 24px; border-width: 2px;"></div></div>' +
                        '<img src="' + esc(r.banner_image) + '" style="opacity: 0; transition: opacity 0.25s ease;">' +
                    '</div>' : '') +
                '<div class="review-desc" style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">' + esc(r.description || '') + '</div>';

            const banner = card.querySelector('.product-banner');
            if (banner && r.banner_image) {
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
                    openImagePreview(r.banner_image);
                });
            }

            grid.appendChild(card);
        });
    }

    // Local image preview helper (queries dynamically)
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

    let loaded = false;
    async function load() {
        showStatus('Loading reviews...');
        try {
            const res = await api.invoke('app-fetch-endpoint', 'reviews');
            if (!res || !res.success) throw new Error((res && res.error) || 'fetch failed');
            const data = JSON.parse(res.text);
            const list = Array.isArray(data) ? data : (data.reviews || data.items || []);
            render(list);
        } catch (e) {
            console.error('[Reviews] load failed:', e && e.message);
            showStatus('Failed to load reviews.', false);
        }
    }

    const menuBtn = document.getElementById('menuReviewsButton');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            if (!loaded) {
                loaded = true;
                load();
            }
        });
    }
})();
