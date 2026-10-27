(function () {
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);
    const menuBtn = $('menuRetroPlayButton');
    const retroPlayView = $('retroPlayView');
    const grid = $('retroPlayGrid');
    if (!api || !grid || !retroPlayView) return;

    const search = $('retroPlaySearch');
    const refreshBtn = $('retroPlayRefresh');
    const status = $('retroPlayStatus');
    const categoryStrip = $('retroPlayCategoryScroller');
    const prevBtn = $('retroPlayCategoryPrev');
    const nextBtn = $('retroPlayCategoryNext');
    const allTab = $('retroPlayAllTab');
    const installedTab = $('retroPlayInstalledTab');
    const signInBtn = $('retroPlayArchiveSignIn');
    const openLibraryBtn = $('retroPlayOpenLibrary');
    const downloadBar = $('retroPlayDownloadBar');
    const downloadText = $('retroPlayDownloadText');
    const progressInner = $('retroPlayProgressInner');
    const etaText = $('retroPlayEtaText');
    const pauseBtn = $('retroPlayPauseBtn');
    const resumeBtn = $('retroPlayResumeBtn');
    const stopBtn = $('retroPlayStopBtn');

    let loaded = false;
    let allGames = [];
    let installs = {};
    let categories = [];
    let currentCategory = 'all';
    let currentMode = 'all';
    let activeTask = null;
    let taskStartedAt = 0;
    let noticeTimer = null;
    let gamepadDirection = '';
    let gamepadDirectionStartedAt = 0;
    let gamepadLastMoveAt = 0;
    let gamepadConfirmPressed = false;
    let gamepadCancelPressed = false;
    let gamepadPreviousDirections = new Set();
    let controllerNavigationActive = false;

    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function showStatus(message, type, loader) {
        grid.innerHTML = '';
        status.style.display = 'block';
        status.className = 'list-status-message ' + (type || 'info');
        status.innerHTML = loader
            ? '<div class="zoneplay-inline-loader"><div class="loader"></div><span>' + esc(message) + '</span></div>'
            : esc(message);
    }

    function announce(message, type) {
        status.style.display = 'block';
        status.className = 'list-status-message ' + (type || 'info');
        status.textContent = message || '';
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => {
            status.style.display = 'none';
            noticeTimer = null;
        }, 6500);
    }

    function installForGame(game) {
        return installs && installs[game.id] || null;
    }

    function formatBytes(value) {
        let size = Number(value || 0);
        if (size < 1024) return size + ' B';
        const units = ['KB', 'MB', 'GB', 'TB'];
        size /= 1024;
        let index = 0;
        while (size >= 1024 && index < units.length - 1) {
            size /= 1024;
            index += 1;
        }
        return size.toFixed(size >= 10 ? 1 : 2) + ' ' + units[index];
    }

    function formatEta(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '--';
        if (seconds < 60) return Math.ceil(seconds) + 's';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + 'm ' + Math.ceil(seconds % 60) + 's';
        return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
    }

    function isRetroPlayFocused() {
        return retroPlayView.classList.contains('active-view') &&
            !document.hidden && document.hasFocus();
    }

    function activeRetroPlayConfirmModal() {
        const modal = $('customConfirmModal');
        return modal && modal.dataset.retroplayController === 'true' && modal.style.display !== 'none'
            ? modal
            : null;
    }

    function isRetroPlayGamepadTarget(element) {
        const confirmModal = activeRetroPlayConfirmModal();
        return retroPlayView.contains(element) || Boolean(confirmModal && confirmModal.contains(element));
    }

    function gamepadTargets() {
        const root = activeRetroPlayConfirmModal() || retroPlayView;
        return Array.from(root.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), [role="button"], [tabindex]:not([tabindex="-1"])'
        )).filter((element) => {
            if (!element.isConnected || element.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length) return false;
            if (element.classList.contains('retroplay-category-chip')) {
                const rect = element.getBoundingClientRect();
                const stripRect = categoryStrip.getBoundingClientRect();
                return rect.left >= stripRect.left - 1 && rect.right <= stripRect.right + 1;
            }
            return true;
        });
    }

    function preferredGamepadTarget() {
        const confirmModal = activeRetroPlayConfirmModal();
        if (confirmModal) return $('customConfirmCancel') || $('customConfirmProceed');
        return grid.querySelector('.retroplay-category-card') ||
            grid.querySelector('.retroplay-card button:not(:disabled)') ||
            categoryStrip.querySelector('.retroplay-category-chip.active') ||
            allTab || search;
    }

    function focusRetroPlayTarget(element) {
        if (!element || !isRetroPlayGamepadTarget(element)) return;
        element.focus({ preventScroll: true });
        if (element.id === 'retroPlayCategoryPrev' || element.id === 'retroPlayCategoryNext' ||
            element.classList.contains('retroplay-category-chip')) return;
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function hasConnectedGamepad() {
        return Boolean(navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean));
    }

    function moveRetroPlayFocus(direction) {
        const targets = gamepadTargets();
        if (!targets.length) return;

        const current = document.activeElement;
        if (!isRetroPlayGamepadTarget(current) || !targets.includes(current)) {
            focusRetroPlayTarget(preferredGamepadTarget() || targets[0]);
            return;
        }

        if (current === search && direction === 'right' && targets.includes(signInBtn)) {
            focusRetroPlayTarget(signInBtn);
            return;
        }
        if (current === signInBtn && direction === 'left' && targets.includes(search)) {
            focusRetroPlayTarget(search);
            return;
        }

        const currentRect = current.getBoundingClientRect();
        const currentX = currentRect.left + currentRect.width / 2;
        const currentY = currentRect.top + currentRect.height / 2;
        let best = null;
        let bestScore = Infinity;

        targets.forEach((candidate) => {
            if (candidate === current) return;
            const rect = candidate.getBoundingClientRect();
            const dx = rect.left + rect.width / 2 - currentX;
            const dy = rect.top + rect.height / 2 - currentY;
            const primary = direction === 'left' || direction === 'right' ? dx : dy;
            const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
            if ((direction === 'left' && primary >= -8) ||
                (direction === 'right' && primary <= 8) ||
                (direction === 'up' && primary >= -8) ||
                (direction === 'down' && primary <= 8)) return;

            const score = Math.abs(primary) + secondary * 1.6;
            if (score < bestScore) {
                best = candidate;
                bestScore = score;
            }
        });

        if (best) focusRetroPlayTarget(best);
    }

    function readGamepadInput() {
        if (!navigator.getGamepads) {
            gamepadDirection = '';
            gamepadConfirmPressed = false;
            gamepadCancelPressed = false;
            gamepadPreviousDirections.clear();
            return;
        }

        const gamepads = Array.from(navigator.getGamepads()).filter(Boolean);
        if (!gamepads.length) {
            gamepadDirection = '';
            gamepadConfirmPressed = false;
            gamepadCancelPressed = false;
            gamepadPreviousDirections.clear();
            return;
        }

        const directions = new Set();
        let confirmPressed = false;
        let cancelPressed = false;
        let strongestX = 0;
        let strongestY = 0;
        gamepads.forEach((gamepad) => {
            const pressed = (index) => Boolean(gamepad.buttons[index] && gamepad.buttons[index].pressed);
            if (pressed(12)) directions.add('up');
            if (pressed(13)) directions.add('down');
            if (pressed(14)) directions.add('left');
            if (pressed(15)) directions.add('right');
            confirmPressed = confirmPressed || pressed(0);
            cancelPressed = cancelPressed || pressed(1);

            const x = Number(gamepad.axes[0] || 0);
            const y = Number(gamepad.axes[1] || 0);
            if (Math.abs(x) > Math.abs(strongestX)) strongestX = x;
            if (Math.abs(y) > Math.abs(strongestY)) strongestY = y;
        });

        if (strongestX <= -0.55) directions.add('left');
        if (strongestX >= 0.55) directions.add('right');
        if (strongestY <= -0.55) directions.add('up');
        if (strongestY >= 0.55) directions.add('down');
        if (directions.has('left') && directions.has('right')) {
            directions.delete('left');
            directions.delete('right');
        }
        if (directions.has('up') && directions.has('down')) {
            directions.delete('up');
            directions.delete('down');
        }

        let direction = '';
        if (directions.size === 1) {
            direction = directions.values().next().value;
        } else if (directions.size > 1) {
            const horizontal = directions.has('left') || directions.has('right');
            const vertical = directions.has('up') || directions.has('down');
            if (horizontal && vertical) {
                if (Math.abs(strongestX) > Math.abs(strongestY)) {
                    direction = strongestX < 0 ? 'left' : 'right';
                } else {
                    direction = strongestY < 0 ? 'up' : 'down';
                }
            }
        }

        const freshDirection = Array.from(directions).some((item) => !gamepadPreviousDirections.has(item));
        const freshConfirm = confirmPressed && !gamepadConfirmPressed;
        const freshCancel = cancelPressed && !gamepadCancelPressed;
        gamepadPreviousDirections = new Set(directions);
        gamepadConfirmPressed = confirmPressed;
        gamepadCancelPressed = cancelPressed;

        if (!isRetroPlayFocused()) {
            gamepadDirection = '';
            return;
        }

        if (!controllerNavigationActive) {
            if (!freshDirection && !freshConfirm && !(freshCancel && activeRetroPlayConfirmModal())) return;
            controllerNavigationActive = true;
            if (freshConfirm && !freshDirection) direction = '';
        }

        const now = Date.now();
        if (direction) {
            if (direction !== gamepadDirection) {
                gamepadDirection = direction;
                gamepadDirectionStartedAt = now;
                gamepadLastMoveAt = now;
                moveRetroPlayFocus(direction);
            } else if (now - gamepadDirectionStartedAt >= 400 && now - gamepadLastMoveAt >= 170) {
                gamepadLastMoveAt = now;
                moveRetroPlayFocus(direction);
            }
        } else {
            gamepadDirection = '';
        }

        if (freshConfirm) {
            let target = document.activeElement;
            if (!isRetroPlayGamepadTarget(target) || !gamepadTargets().includes(target)) {
                target = preferredGamepadTarget() || gamepadTargets()[0];
                focusRetroPlayTarget(target);
            } else {
                target.click();
            }
        }

        if (freshCancel) {
            const confirmModal = activeRetroPlayConfirmModal();
            const cancelButton = confirmModal && $('customConfirmCancel');
            if (cancelButton && cancelButton.style.display !== 'none') cancelButton.click();
        }
    }

    function setProgressText(parts) {
        const percent = parts.percent || '--';
        const size = parts.size || '';
        const eta = parts.eta || '';
        etaText.innerHTML =
            '<span class="zp-progress-pct">' + esc(percent) + '</span>' +
            '<span class="zp-progress-size">' + esc(size) + '</span>' +
            '<span class="zp-progress-eta">' + esc(eta) + '</span>';
    }

    function setDownloadControls(state) {
        pauseBtn.disabled = state !== 'downloading';
        resumeBtn.disabled = state !== 'paused';
        stopBtn.disabled = !state || state === 'complete' || state === 'error' || state === 'canceled';
    }

    function updateDownloadBar(task) {
        if (!task) {
            activeTask = null;
            downloadBar.style.display = 'none';
            progressInner.classList.remove('indeterminate');
            progressInner.style.width = '0%';
            setDownloadControls('');
            return;
        }
        activeTask = task;
        downloadBar.style.display = 'flex';
        downloadText.textContent = task.message || 'Working...';
        const total = Number(task.total || 0);
        const transferred = Number(task.transferred || 0);
        const percent = total > 0 ? Math.max(0, Math.min(100, Math.round(transferred / total * 100))) : 0;
        progressInner.classList.toggle('indeterminate', !total && task.status !== 'paused');
        progressInner.style.width = total > 0 ? percent + '%' : (task.status === 'paused' ? '0%' : '45%');
        if (task.phase === 'extracting') {
            setProgressText(total > 0
                ? { percent: percent + '%', size: formatBytes(transferred) + ' / ' + formatBytes(total), eta: '' }
                : { percent: 'Extracting', size: formatBytes(transferred) + ' unpacked', eta: '' });
            downloadText.textContent = 'Verifying files...';
        } else if (total > 0) {
            const elapsed = Math.max(0.25, (Date.now() - taskStartedAt) / 1000);
            const rate = transferred / elapsed;
            const eta = rate > 0 ? (total - transferred) / rate : -1;
            setProgressText({
                percent: percent + '%',
                size: formatBytes(transferred) + ' / ' + formatBytes(total),
                eta: 'ETA ' + formatEta(eta)
            });
            downloadText.textContent = 'Downloading package...';
        } else {
            setProgressText({ percent: '', size: formatBytes(transferred), eta: '' });
            if (task.status === 'downloading') downloadText.textContent = 'Downloading package...';
        }
        setDownloadControls(task.status);
    }

    function updateArchiveStatus(value) {
        const signedIn = Boolean(value && value.signedIn);
        signInBtn.innerHTML = signedIn
            ? '<i class="fas fa-user-check"></i><span class="retroplay-auth-label">Signed in</span><span class="retroplay-auth-hover-label">Sign out</span>'
            : '<i class="fas fa-user-shield"></i> Sign in';
        signInBtn.classList.toggle('signed-in', signedIn);
        signInBtn.setAttribute('aria-label', signedIn ? 'Signed in. Click to sign out.' : 'Sign in');
    }

    function buildCategories() {
      const groupOrder = ['Nintendo', 'Sega', 'Arcade', 'Atari', 'NEC', 'SNK', 'Sony'];
      const groupLogos = {
          Nintendo: 'nintendo.png',
          Sega: 'sega.png',
          Arcade: 'mame.png',
          Atari: 'atari.png',
          NEC: 'pce.png',
          SNK: 'neogeo.png',
          Sony: 'playstation.png'
      };
      const systemLogos = {
          pce: 'pce.png',
          'pce-cd': 'pce.png'
      };
      const hasSystemMetadata = allGames.some((game) => game.systemName || game.platform);
      const groupSet = new Set(allGames.map((game) => String(
          game.group || game.systemGroup || (!hasSystemMetadata ? game.category : '') || ''
      ).trim()).filter(Boolean));
        const groups = Array.from(groupSet).sort((a, b) => {
            const ai = groupOrder.indexOf(a);
            const bi = groupOrder.indexOf(b);
            return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b);
        });
        const systems = new Map();
        allGames.forEach((game) => {
            if (!game.category || (!game.systemName && !game.platform)) return;
            if (!systems.has(game.category)) {
                systems.set(game.category, {
                    key: 'system:' + game.category,
                    label: game.systemName || game.platform || game.category,
                    group: game.systemGroup || game.group || game.category,
                    logoFile: groupLogos[game.systemGroup || game.group || game.category] || systemLogos[game.category] || ''
                });
            }
        });
        const groupItems = groups.map((group) => ({
            key: 'group:' + group,
            label: group,
            group: group,
            logoFile: groupLogos[group] || ''
        }));
        const systemItems = Array.from(systems.values()).sort((a, b) => {
            const ai = groupOrder.indexOf(a.group);
            const bi = groupOrder.indexOf(b.group);
            return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.label.localeCompare(b.label);
        });
        categories = groupItems.concat(systemItems);
    }

    function countForCategory(category) {
        const matches = (game) => {
            if (category.key === 'all') return true;
            if (category.key.startsWith('group:')) {
                const group = category.key.slice(6);
                return (game.group || game.systemGroup || game.category) === group;
            }
            return game.category === category.key.slice(7);
        };
        return allGames.filter(matches).length;
    }

    function updateCategoryArrows() {
        if (!prevBtn || !nextBtn) return;
        const maxScroll = Math.max(0, categoryStrip.scrollWidth - categoryStrip.clientWidth);
        const hasOverflow = maxScroll > 2;
        prevBtn.style.display = hasOverflow ? 'inline-flex' : 'none';
        nextBtn.style.display = hasOverflow ? 'inline-flex' : 'none';
        prevBtn.disabled = !hasOverflow || categoryStrip.scrollLeft <= 1;
        nextBtn.disabled = !hasOverflow || categoryStrip.scrollLeft >= maxScroll - 1;
    }

    function renderCategories() {
        categoryStrip.innerHTML = '';
        allTab.classList.toggle('active', currentMode === 'all' && currentCategory === 'all');
        installedTab.classList.toggle('active', currentMode === 'installed');

        categories.forEach((category) => {
            const count = countForCategory(category);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gamelist-category-chip retroplay-category-chip' + (currentCategory === category.key ? ' active' : '');
            button.setAttribute('aria-label', category.label + ', ' + count + ' games');

            if (category.logoFile) {
                const logo = document.createElement('img');
                logo.className = 'retroplay-category-logo';
                if (category.logoFile === 'nintendo.png' || category.logoFile === 'playstation.png') {
                    logo.classList.add('retroplay-category-logo-light');
                }
                logo.loading = 'lazy';
                logo.src = './retro-category-logos/' + encodeURIComponent(category.logoFile);
                logo.onerror = () => {
                    const fallback = document.createElement('i');
                    fallback.className = 'fas fa-gamepad retroplay-category-icon';
                    logo.replaceWith(fallback);
                };
                button.appendChild(logo);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-gamepad retroplay-category-icon';
                button.appendChild(icon);
            }

            const label = document.createElement('span');
            label.className = 'retroplay-category-name';
            label.textContent = category.label;
            const countLabel = document.createElement('span');
            countLabel.className = 'retroplay-category-count';
            countLabel.textContent = String(count);
            button.append(label, countLabel);
            button.addEventListener('click', () => {
                const restoreGamepadFocus = controllerNavigationActive;
                currentCategory = category.key;
                renderCategories();
                render();
                requestAnimationFrame(() => {
                    if (restoreGamepadFocus && controllerNavigationActive) {
                        focusRetroPlayTarget(preferredGamepadTarget());
                    }
                });
            });
            categoryStrip.appendChild(button);
        });

        requestAnimationFrame(() => {
            if (currentCategory === 'all') {
                categoryStrip.scrollLeft = 0;
            } else {
                const activeButton = categoryStrip.querySelector('.retroplay-category-chip.active');
                if (activeButton) activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
            updateCategoryArrows();
        });
    }

    function matchesCategory(game) {
        if (currentCategory === 'all') return true;
        if (currentCategory.startsWith('group:')) {
            const group = currentCategory.slice(6);
            return (game.group || game.systemGroup || game.category) === group;
        }
        return game.category === currentCategory.slice(7);
    }

    function searchWords(value) {
        return String(value == null ? '' : value)
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)
            .filter(Boolean);
    }

    function filteredGames() {
        const term = String(search.value || '').trim();
        const queryWords = searchWords(term);
        return allGames.filter((game) => {
            const words = searchWords([
                game.name, game.systemName, game.systemGroup, game.group,
                game.platform, game.category
            ].join(' '));
            const matchSearch = !term || (queryWords.length > 0 && queryWords.every((queryWord) =>
                words.some((word) => word.startsWith(queryWord))
            ));
            const installed = Boolean(installForGame(game));
            const matchCategory = currentMode === 'installed' || matchesCategory(game);
            return matchSearch && matchCategory && (currentMode === 'all' || installed);
        });
    }

    function render() {
        if (currentMode === 'all' && currentCategory === 'all' && !String(search.value || '').trim()) {
            renderCategoryCards();
            return;
        }
        const list = filteredGames();
        grid.innerHTML = '';
        if (!list.length) {
            const message = currentMode === 'installed'
                ? 'No installed Retro Play games found.'
                : 'No Retro Play games match this view.';
            showStatus(message, 'info', false);
            return;
        }
        status.style.display = 'none';
        const fragment = document.createDocumentFragment();
        list.forEach((game) => {
            const install = installForGame(game);
            const card = document.createElement('div');
            card.className = 'game-item zoneplay-card retroplay-card';
            const title = game.name || 'Untitled';
            const systemLabel = [game.systemGroup || game.group, game.systemName || game.platform]
                .filter(Boolean).join(' · ') || 'Retro';
            const logo = './retro-logos/' + encodeURIComponent(game.logoFile || 'default.png');
            const thumbnailUrl = game.thumbnailUrl ? esc(game.thumbnailUrl) : '';
            const installedActions = install
                ? '<button class="game-item-button update-btn zoneplay-card-btn zoneplay-play-btn" type="button" aria-label="Play"><i class="fas fa-play"></i></button>' +
                  '<button class="game-item-button update-btn zoneplay-card-btn retroplay-folder-btn" type="button" aria-label="Open game folder"><i class="fas fa-folder-open"></i></button>' +
                  '<button class="game-item-button update-btn zoneplay-card-btn zoneplay-delete-btn retroplay-delete-btn" type="button" aria-label="Uninstall"><i class="fas fa-trash"></i></button>'
                : '<button class="game-item-button update-btn zoneplay-download-btn retroplay-download-btn" type="button"><i class="fas fa-download"></i> <span>Download</span></button>';
            card.innerHTML =
                '<div class="gamelist-thumb-wrap zoneplay-thumb retroplay-thumb">' +
                    '<img class="retroplay-game-image' + (thumbnailUrl ? ' retroplay-game-thumbnail' : '') + '" src="' + (thumbnailUrl || esc(logo)) + '"' + (thumbnailUrl ? ' crossorigin="anonymous"' : '') + ' loading="lazy">' +
                    (install ? '<div class="gamelist-thumb-badges"><span class="gamelist-thumb-badge bypass">INSTALLED</span></div>' : '') +
                '</div>' +
                '<div class="game-info">' +
                    '<h3 class="game-name">' + esc(title) + '</h3>' +
                    '<p class="zoneplay-category-label">' + esc(systemLabel) + '</p>' +
                '</div>' +
                '<div class="game-item-actions zoneplay-card-actions retroplay-card-actions">' + installedActions + '</div>';
            const gameImage = card.querySelector('.retroplay-game-image');
            gameImage.addEventListener('error', () => {
                if (thumbnailUrl) {
                    gameImage.classList.remove('retroplay-game-thumbnail');
                    gameImage.addEventListener('error', () => { gameImage.src = 'udp.ico'; }, { once: true });
                    gameImage.src = logo;
                } else {
                    gameImage.src = 'udp.ico';
                }
            }, { once: true });
            const downloadBtn = card.querySelector('.retroplay-download-btn');
            if (downloadBtn) downloadBtn.addEventListener('click', () => startDownload(game));
            const playBtn = card.querySelector('.zoneplay-play-btn');
            if (playBtn) playBtn.addEventListener('click', () => playGame(game));
            const folderBtn = card.querySelector('.retroplay-folder-btn');
            if (folderBtn) folderBtn.addEventListener('click', () => openGameFolder(game));
            const deleteBtn = card.querySelector('.retroplay-delete-btn');
            if (deleteBtn) deleteBtn.addEventListener('click', () => uninstallGame(game));
            fragment.appendChild(card);
        });
        grid.appendChild(fragment);
    }

    function renderCategoryCards() {
        grid.innerHTML = '';
        status.style.display = 'none';
        const fragment = document.createDocumentFragment();
        categories.forEach((category) => {
            const count = countForCategory(category);
            const card = document.createElement('div');
            card.className = 'game-item zoneplay-card retroplay-card retroplay-category-card';
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.setAttribute('aria-label', category.label + ', ' + count + ' games');

            const thumb = document.createElement('div');
            thumb.className = 'gamelist-thumb-wrap zoneplay-thumb retroplay-thumb retroplay-category-card-thumb';
            if (category.logoFile) {
                const logo = document.createElement('img');
                logo.className = 'retroplay-category-card-logo';
                if (category.logoFile === 'nintendo.png' || category.logoFile === 'playstation.png') {
                    logo.classList.add('retroplay-category-logo-light');
                }
                logo.loading = 'lazy';
                logo.src = './retro-category-logos/' + encodeURIComponent(category.logoFile);
                logo.onerror = () => {
                    const fallback = document.createElement('i');
                    fallback.className = 'fas fa-gamepad retroplay-category-card-fallback';
                    logo.replaceWith(fallback);
                };
                thumb.appendChild(logo);
            }

            const info = document.createElement('div');
            info.className = 'game-info';
            const title = document.createElement('h3');
            title.className = 'game-name';
            title.textContent = category.label;
            const details = document.createElement('p');
            details.className = 'zoneplay-category-label';
            details.textContent = count + ' games';
            info.append(title, details);

            const selectCategory = () => {
                const restoreGamepadFocus = controllerNavigationActive;
                currentCategory = category.key;
                renderCategories();
                render();
                requestAnimationFrame(() => {
                    if (restoreGamepadFocus && controllerNavigationActive) {
                        focusRetroPlayTarget(preferredGamepadTarget());
                    }
                });
            };
            card.addEventListener('click', selectCategory);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectCategory();
                }
            });
            card.append(thumb, info);
            fragment.appendChild(card);
        });
        grid.appendChild(fragment);
    }

    async function load() {
        refreshBtn.classList.add('spinning');
        showStatus('Loading Retro Play catalog...', 'info', true);
        try {
            const result = await api.invoke('retro-play-fetch');
            if (!result || !result.success) throw new Error((result && result.message) || 'Could not load Retro Play.');
            allGames = (result.games || []).slice().sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
            installs = result.installs || {};
            buildCategories();
            renderCategories();
            updateArchiveStatus(result.archive || {});
            const active = (result.tasks || []).find((task) =>
                ['queued', 'resolving', 'downloading', 'paused', 'extracting', 'canceling'].includes(task.status));
            if (active) {
                activeTask = active;
                taskStartedAt = Date.now();
                updateDownloadBar(active);
            } else {
                updateDownloadBar(null);
            }
            render();
            loaded = true;
            if (isRetroPlayFocused() && controllerNavigationActive && hasConnectedGamepad()) {
                requestAnimationFrame(() => {
                    if (controllerNavigationActive) focusRetroPlayTarget(preferredGamepadTarget());
                });
            }
        } catch (error) {
            loaded = false;
            showStatus(error.message || 'Could not load Retro Play.', 'error', false);
        } finally {
            refreshBtn.classList.remove('spinning');
        }
    }

    async function startDownload(game) {
        if (activeTask && ['queued', 'resolving', 'downloading', 'paused', 'extracting', 'canceling'].includes(activeTask.status)) {
            announce('Finish or stop the current download before starting another game.', 'info');
            return;
        }
        const result = await api.invoke('retro-play-start', game.id);
        if (!result || !result.success) {
            announce((result && result.message) || 'Could not start the download.', 'error');
            return;
        }
        activeTask = { taskId: result.taskId, gameId: game.id, name: game.name, status: 'queued', phase: 'queued', transferred: 0, total: 0, message: 'Starting download...' };
        taskStartedAt = Date.now();
        updateDownloadBar(activeTask);
        render();
    }

    async function playGame(game) {
        const result = await api.invoke('retro-play-launch', game.id);
        if (!result || !result.success) announce((result && result.message) || 'Could not start the game.', 'error');
    }

    async function openGameFolder(game) {
        const result = await api.invoke('retro-play-open-game-folder', game.id);
        if (!result || !result.success) announce((result && result.message) || 'Could not open the game folder.', 'error');
    }

    async function uninstallGame(game) {
        const title = game.name || 'this game';
        const returnFocusTarget = document.activeElement;
        let confirmDelete;
        if (typeof showCustomConfirm === 'function') {
            const confirmation = showCustomConfirm(
                'Uninstall Retro Play Game',
                'Delete ' + title + ' and its installed game files?',
                { confirmText: 'Uninstall', danger: true }
            );
            const confirmModal = $('customConfirmModal');
            if (confirmModal) {
                confirmModal.dataset.retroplayController = 'true';
                if (controllerNavigationActive) {
                    requestAnimationFrame(() => {
                        if (controllerNavigationActive && activeRetroPlayConfirmModal()) {
                            focusRetroPlayTarget($('customConfirmCancel') || $('customConfirmProceed'));
                        }
                    });
                }
            }
            confirmDelete = await confirmation;
            if (confirmModal) delete confirmModal.dataset.retroplayController;
            if (!confirmDelete) {
                if (controllerNavigationActive && returnFocusTarget && returnFocusTarget.isConnected) {
                    requestAnimationFrame(() => focusRetroPlayTarget(returnFocusTarget));
                }
                return;
            }
        } else {
            confirmDelete = await window.confirm('Uninstall ' + title + ' and delete its installed files?');
        }
        if (!confirmDelete) return;
        const result = await api.invoke('retro-play-delete', game.id);
        if (!result || !result.success) {
            announce((result && result.message) || 'Uninstall failed.', 'error');
            if (controllerNavigationActive && returnFocusTarget && returnFocusTarget.isConnected) {
                requestAnimationFrame(() => focusRetroPlayTarget(returnFocusTarget));
            }
            return;
        }
        installs = result.installs || {};
        render();
        if (controllerNavigationActive) {
            requestAnimationFrame(() => focusRetroPlayTarget(preferredGamepadTarget()));
        }
    }

    function updateTaskFromEvent(payload) {
        if (!payload) return;
        if (!activeTask || (activeTask.taskId && payload.taskId !== activeTask.taskId)) return;
        activeTask = Object.assign({}, activeTask || {}, payload);
        updateDownloadBar(activeTask);
    }

    api.on('retro-play-download-progress', updateTaskFromEvent);
    api.on('retro-play-download-status', (payload) => {
        if (!payload) return;
        updateTaskFromEvent(payload);
        if (payload.status === 'complete') {
            activeTask = null;
            updateDownloadBar(null);
            load();
        } else if (payload.status === 'error') {
            activeTask = null;
            updateDownloadBar(null);
            announce(payload.message || payload.error || 'Download failed. You can retry from the game card.', 'error');
        } else if (payload.status === 'canceled') {
            activeTask = null;
            updateDownloadBar(null);
            load();
        }
    });
    api.on('retro-play-archive-status', updateArchiveStatus);

    search.addEventListener('input', render);
    categoryStrip.addEventListener('scroll', updateCategoryArrows, { passive: true });
    window.addEventListener('resize', updateCategoryArrows);
    refreshBtn.addEventListener('click', load);
    signInBtn.addEventListener('click', async () => {
        const signedIn = signInBtn.classList.contains('signed-in');
        const result = await api.invoke(signedIn ? 'retro-play-sign-out' : 'retro-play-sign-in');
        if (!result || !result.success) {
            announce((result && result.message) || (signedIn ? 'Could not sign out.' : 'Could not open sign-in.'), 'error');
            return;
        }
        if (signedIn) updateArchiveStatus({ signedIn: false });
    });
    openLibraryBtn.addEventListener('click', async () => {
        const result = await api.invoke('retro-play-open-library');
        if (!result || !result.success) announce((result && result.message) || 'Could not open the Retro Play library.', 'error');
    });
    pauseBtn.addEventListener('click', async () => {
        if (!activeTask || !activeTask.taskId) return;
        await api.invoke('retro-play-pause', activeTask.taskId);
    });
    resumeBtn.addEventListener('click', async () => {
        if (!activeTask || !activeTask.taskId) return;
        await api.invoke('retro-play-resume', activeTask.taskId);
    });
    stopBtn.addEventListener('click', async () => {
        if (!activeTask || !activeTask.taskId) return;
        const result = await api.invoke('retro-play-stop', activeTask.taskId);
        if (result && result.success) {
            activeTask.status = 'canceling';
            activeTask.message = 'Stopping download...';
            updateDownloadBar(activeTask);
        }
    });
    prevBtn.addEventListener('click', () => categoryStrip.scrollBy({ left: -220, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => categoryStrip.scrollBy({ left: 220, behavior: 'smooth' }));

    [allTab, installedTab].forEach((button) => {
        button.addEventListener('click', () => {
            currentMode = button.dataset.mode;
            currentCategory = 'all';
            renderCategories();
            render();
        });
    });

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (!loaded) load();
            }, 0);
        });
    }

    document.addEventListener('focusin', (event) => {
        const target = event.target;
        if (!controllerNavigationActive || !target || !target.classList || !isRetroPlayGamepadTarget(target)) return;
        target.classList.add('retroplay-gamepad-focus');
        const card = target.closest('.retroplay-card');
        if (card) card.classList.add('retroplay-gamepad-card-focus');
    });
    document.addEventListener('focusout', (event) => {
        const target = event.target;
        if (!target || !target.classList) return;
        target.classList.remove('retroplay-gamepad-focus');
        const card = target.closest('.retroplay-card');
        if (card) card.classList.remove('retroplay-gamepad-card-focus');
    });
    const useMouseNavigation = (event) => {
        if (event.pointerType !== 'mouse' || !isRetroPlayFocused() || !controllerNavigationActive) return;
        controllerNavigationActive = false;
        gamepadDirection = '';
        const activeElement = document.activeElement;
        if (activeElement && activeElement.classList && activeElement.classList.contains('retroplay-gamepad-focus')) {
            activeElement.blur();
        }
        [retroPlayView, activeRetroPlayConfirmModal()].filter(Boolean).forEach((root) => {
            root.querySelectorAll('.retroplay-gamepad-focus, .retroplay-gamepad-card-focus').forEach((element) => {
            element.classList.remove('retroplay-gamepad-focus', 'retroplay-gamepad-card-focus');
            });
        });
    };
    document.addEventListener('pointermove', useMouseNavigation, { passive: true });
    document.addEventListener('pointerdown', useMouseNavigation, { passive: true });

    window.setInterval(readGamepadInput, 80);

    renderCategories();
    api.invoke('retro-play-auth-status').then(updateArchiveStatus).catch(() => updateArchiveStatus({ signedIn: false }));
})();
