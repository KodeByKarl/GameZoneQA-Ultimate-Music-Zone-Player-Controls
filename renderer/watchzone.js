(() => {
    'use strict';

    const api = window.electronAPI;
    const $ = id => document.getElementById(id);
    const el = {
        view: $('watchZoneView'), searchForm: $('watchZoneSearchForm'), searchInput: $('watchZoneSearchInput'), refresh: $('watchZoneRefresh'),
        toolbar: document.querySelector('#watchZoneView .watchzone-toolbar'), status: $('watchZoneStatus'), home: $('watchZoneHome'), hero: $('watchZoneHero'),
        tagWrap: $('watchZoneTagWrap'), tagSelect: $('watchZoneTagSelect'), variantWrap: $('watchZoneVariantWrap'), variantSelect: $('watchZoneVariantSelect'),
        continueSection: $('watchZoneContinueSection'), continueRow: $('watchZoneContinue'), continueClear: $('watchZoneContinueClear'), primary: $('watchZonePrimary'), secondary: $('watchZoneSecondary'),
        primaryViewAll: $('watchZonePrimaryViewAll'), secondaryViewAll: $('watchZoneSecondaryViewAll'),
        primaryTitle: $('watchZonePrimaryTitle'), secondaryTitle: $('watchZoneSecondaryTitle'), primaryEyebrow: $('watchZonePrimaryEyebrow'), secondaryEyebrow: $('watchZoneSecondaryEyebrow'),
        results: $('watchZoneResultsView'), resultsEyebrow: $('watchZoneResultsEyebrow'), resultsTitle: $('watchZoneResultsTitle'), resultsGrid: $('watchZoneResultsGrid'),
        resultsMore: $('watchZoneResultsMore'), resultsMoreStatus: $('watchZoneResultsMoreStatus'), resultsLoadMore: $('watchZoneResultsLoadMore'), backHome: $('watchZoneBackHome'),
        playback: $('watchZonePlaybackView'), playerBack: $('watchZonePlayerBack'), playerRefresh: $('watchZonePlayerRefresh'),
        playerEyebrow: $('watchZonePlayerEyebrow'), playerTitle: $('watchZonePlayerTitle'), playerSubtitle: $('watchZonePlayerSubtitle'),
        sourceWrap: $('watchZoneSourceWrap'), sourceSelect: $('watchZoneSourceSelect'),
        playbackStatus: $('watchZonePlaybackStatus'), seriesControls: $('watchZoneSeriesControls'), seasonWrap: $('watchZoneSeasonWrap'), seasonSelect: $('watchZoneSeasonSelect'),
        audioWrap: $('watchZoneAudioWrap'), audioSelect: $('watchZoneAudioSelect'), episodeBrowser: $('watchZoneEpisodeBrowser'),
        episodeSearch: $('watchZoneEpisodeSearch'), episodeCount: $('watchZoneEpisodeCount'), episodePagination: $('watchZoneEpisodePagination'),
        episodePagePrevious: $('watchZoneEpisodePagePrevious'), episodePageNext: $('watchZoneEpisodePageNext'), episodePageInfo: $('watchZoneEpisodePageInfo'),
        episodeList: $('watchZoneEpisodeList'), playerHost: $('watchZonePlayerHost'), scrollArea: $('mainContentArea')
    };
    if (!api || !el.view) return;
    const watchDropdowns = [
        { select: el.sourceSelect, root: $('watchZoneSourceDropdown'), button: $('watchZoneSourceButton'), label: $('watchZoneSourceLabel'), options: $('watchZoneSourceOptions') },
        { select: el.seasonSelect, root: $('watchZoneSeasonDropdown'), button: $('watchZoneSeasonButton'), label: $('watchZoneSeasonLabel'), options: $('watchZoneSeasonOptions') },
        { select: el.audioSelect, root: $('watchZoneAudioDropdown'), button: $('watchZoneAudioButton'), label: $('watchZoneAudioLabel'), options: $('watchZoneAudioOptions') },
        { select: el.tagSelect, root: $('watchZoneTagDropdown'), button: $('watchZoneTagButton'), label: $('watchZoneTagLabel'), options: $('watchZoneTagOptions') },
        { select: el.variantSelect, root: $('watchZoneVariantDropdown'), button: $('watchZoneVariantButton'), label: $('watchZoneVariantLabel'), options: $('watchZoneVariantOptions') }
    ];

    let mode = 'movie';
    let active = false;
    let loadedModes = new Set();
    let iptvChannels = null;
    let iptvLoading = false;
    let iptvRequest = 0;
    let selectedIptvTag = '__all';
    let availableVariants = [];
    let selectedVariantIndex = 0;
    let currentHome = null;
    let heroSlides = [];
    let heroIndex = 0;
    let heroTimer = null;
    let heroMode = '';
    let heroHovered = false;
    let activeSearch = '';
    let viewAllState = null;
    let browseReturn = null;
    let currentMedia = null;
    let availableSources = [];
    let selectedSourceIndex = null;
    let seasons = [];
    let episodes = [];
    let selectedSeason = 1;
    let selectedEpisode = 1;
    let episodePage = 1;
    let episodeSearchQuery = '';
    let episodeLoading = false;
    const episodesPerPage = 12;
    let activeAudio = 'sub';
    let watchDropdownOpen = false;
    let playerStarted = false;
    let busy = false;
    let latestRequest = 0;
    let playbackRequest = 0;
    let resumeOnStart = false;
    const itemCache = new Map();
    const progressCache = new Map();

    const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const safeImage = value => {
        try {
            const url = new URL(String(value || ''), window.location.href);
            return ['https:', 'http:'].includes(url.protocol) ? url.toString().replace(/"/g, '%22') : '';
        } catch (_) { return ''; }
    };
    function setStatus(message = '', kind = '') {
        el.status.textContent = message;
        el.status.className = `watchzone-status${kind ? ` ${kind}` : ''}`;
    }
    function setPlaybackStatus(message = '', kind = '') {
        el.playbackStatus.textContent = message;
        el.playbackStatus.className = `watchzone-playback-status${kind ? ` ${kind}` : ''}`;
    }
    function closeWatchDropdowns() {
        const hadOpenDropdown = watchDropdowns.some(dropdown => dropdown.root.classList.contains('open'));
        watchDropdowns.forEach(dropdown => {
            dropdown.root.classList.remove('open');
            dropdown.button.setAttribute('aria-expanded', 'false');
        });
        if (hadOpenDropdown) {
            watchDropdownOpen = false;
            el.playerHost.classList.remove('dropdown-menu-open');
            requestAnimationFrame(syncPlayerBounds);
        }
    }
    function positionWatchDropdown(dropdown) {
        const rect = dropdown.button.getBoundingClientRect();
        const menuHeight = Math.min(dropdown.options.scrollHeight, 240, window.innerHeight * .45);
        const top = rect.bottom + 6;
        Object.assign(dropdown.options.style, {
            position: 'fixed', left: `${rect.left}px`, right: 'auto', width: `${rect.width}px`,
            top: `${top + menuHeight > window.innerHeight ? Math.max(6, rect.top - menuHeight - 6) : top}px`
        });
        // BrowserView paints above renderer DOM regardless of z-index. Hide
        // only its surface while a menu is open; playback itself keeps running.
        watchDropdownOpen = true;
        el.playerHost.classList.add('dropdown-menu-open');
        requestAnimationFrame(syncPlayerBounds);
    }
    function containDropdownWheel(options, event) {
        event.preventDefault();
        event.stopPropagation();
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? options.clientHeight : 1;
        options.scrollTop += event.deltaY * multiplier;
    }
    function syncWatchDropdown(dropdown) {
        const selected = dropdown.select.selectedOptions[0] || dropdown.select.options[0];
        dropdown.label.textContent = selected?.textContent || (dropdown.select === el.sourceSelect ? 'No source' : 'Select');
        dropdown.root.dataset.value = dropdown.select.value;
        dropdown.button.disabled = dropdown.select.disabled;
        dropdown.options.replaceChildren();
        Array.from(dropdown.select.options).forEach(option => {
            const choice = document.createElement('button');
            choice.type = 'button';
            choice.className = 'gamelist-sort-option';
            choice.setAttribute('role', 'option');
            choice.setAttribute('aria-selected', String(option.value === dropdown.select.value));
            choice.classList.toggle('active', option.value === dropdown.select.value);
            choice.textContent = option.textContent;
            choice.addEventListener('click', () => {
                if (dropdown.select.disabled) return;
                dropdown.select.value = option.value;
                dropdown.select.dispatchEvent(new Event('change', { bubbles: true }));
                closeWatchDropdowns();
                dropdown.button.focus({ preventScroll: true });
            });
            dropdown.options.appendChild(choice);
        });
    }
    function setupWatchDropdown(dropdown) {
        dropdown.options.addEventListener('wheel', event => containDropdownWheel(dropdown.options, event), { passive: false });
        dropdown.button.addEventListener('click', () => {
            if (dropdown.button.disabled) return;
            const shouldOpen = !dropdown.root.classList.contains('open');
            closeWatchDropdowns();
            if (!shouldOpen) return;
            dropdown.root.classList.add('open');
            dropdown.button.setAttribute('aria-expanded', 'true');
            positionWatchDropdown(dropdown);
        });
        dropdown.root.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeWatchDropdowns();
                dropdown.button.focus();
                return;
            }
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            if (!dropdown.root.classList.contains('open')) {
                closeWatchDropdowns();
                dropdown.root.classList.add('open');
                dropdown.button.setAttribute('aria-expanded', 'true');
                positionWatchDropdown(dropdown);
            }
            const choices = Array.from(dropdown.options.querySelectorAll('.gamelist-sort-option'));
            if (!choices.length) return;
            event.preventDefault();
            const current = choices.indexOf(document.activeElement);
            const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
            choices[next].focus();
        });
        syncWatchDropdown(dropdown);
    }
    watchDropdowns.forEach(setupWatchDropdown);
    document.addEventListener('click', event => {
        if (!event.target.closest('.watchzone-dropdown')) closeWatchDropdowns();
    });
    function renderPlaybackError(error) {
        const detail = String(error?.message || 'Playback could not be started.');
        const noSource = /no playable source/i.test(detail);
        el.playerHost.innerHTML = `<div class="watchzone-player-placeholder watchzone-player-error" role="alert"><div class="watchzone-error-card"><div class="watchzone-error-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></div><span class="watchzone-error-eyebrow">WATCH ZONE · PLAYER</span><h3>${noSource ? 'No stream available' : 'Playback couldn’t start'}</h3><p>${escapeHtml(detail)}</p><div class="watchzone-error-actions"><button id="watchZoneErrorRetry" class="watchzone-error-retry" type="button"><i class="fas fa-rotate-right" aria-hidden="true"></i> Try again</button><button id="watchZoneErrorBack" class="watchzone-error-back" type="button">Back to titles</button></div></div></div>`;
        el.playerHost.querySelector('#watchZoneErrorRetry')?.addEventListener('click', event => {
            const button = event.currentTarget;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Retrying…';
            startPlayback(true);
        });
        el.playerHost.querySelector('#watchZoneErrorBack')?.addEventListener('click', backToBrowse);
    }
    function renderSourceOptions(sources, preferredIndex) {
        availableSources = Array.isArray(sources)
            ? sources.filter(source => Number.isInteger(Number(source.index)) && !(mode === 'anime' && source.embed))
            : [];
        const selected = availableSources.find(source => Number(source.index) === Number(preferredIndex)) || availableSources[0];
        selectedSourceIndex = selected ? Number(selected.index) : null;
        el.sourceSelect.innerHTML = availableSources.map((source, position) => {
            const label = source.label || `Source ${position + 1}`;
            const details = [source.quality].filter(Boolean).join(' · ');
            const text = details ? `${label} · ${details}` : label;
            return `<option value="${Number(source.index)}">${escapeHtml(text)}</option>`;
        }).join('');
        if (selected) el.sourceSelect.value = String(selected.index);
        el.sourceWrap.hidden = availableSources.length <= 1;
        el.sourceSelect.disabled = availableSources.length <= 1;
        syncWatchDropdown(watchDropdowns[0]);
    }
    function renderVariantOptions(variants, preferredIndex) {
        availableVariants = Array.isArray(variants) ? variants.filter(variant => Number.isInteger(Number(variant.index))) : [];
        const selected = availableVariants.find(variant => Number(variant.index) === Number(preferredIndex)) || availableVariants[0];
        selectedVariantIndex = selected ? Number(selected.index) : 0;
        el.variantSelect.innerHTML = availableVariants.map(variant =>
            '<option value="' + Number(variant.index) + '">' + escapeHtml(variant.label || variant.field || 'Proxy URL') + '</option>'
        ).join('');
        if (selected) el.variantSelect.value = String(selected.index);
        el.variantWrap.hidden = mode !== 'iptv' || availableVariants.length <= 1;
        el.variantSelect.disabled = availableVariants.length <= 1;
        syncWatchDropdown(watchDropdowns[4]);
    }
    function toggleModeButtons() {
        document.querySelectorAll('[data-watch-mode]').forEach(button => {
            const selected = button.dataset.watchMode === mode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        el.searchInput.placeholder = mode === 'cartoon' ? 'Search cartoon series' : mode === 'anime' ? 'Search anime' : mode === 'iptv' ? 'Search channels or tags' : 'Search movies and shows';
        el.tagWrap.hidden = mode !== 'iptv';
        el.backHome.hidden = mode === 'iptv';
    }
    function renderIptvTagOptions(channels) {
        const uniqueTags = new Map();
        (channels || []).flatMap(channel => Array.isArray(channel.tags) ? channel.tags : []).forEach(rawTag => {
            const tag = String(rawTag || '').trim();
            if (tag && !uniqueTags.has(tag.toLowerCase())) uniqueTags.set(tag.toLowerCase(), tag);
        });
        const tags = Array.from(uniqueTags.values()).sort((left, right) => left.localeCompare(right));
        if (selectedIptvTag !== '__all' && !tags.some(tag => tag.toLowerCase() === selectedIptvTag.toLowerCase())) selectedIptvTag = '__all';
        el.tagSelect.replaceChildren();
        const allTags = document.createElement('option');
        allTags.value = '__all';
        allTags.textContent = 'All tags';
        el.tagSelect.appendChild(allTags);
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            el.tagSelect.appendChild(option);
        });
        el.tagSelect.value = selectedIptvTag;
        syncWatchDropdown(watchDropdowns[3]);
    }
    function iptvCardMarkup(channel) {
        const id = escapeHtml(channel.id || channel.name);
        const name = escapeHtml(channel.name || 'Live channel');
        const logo = safeImage(channel.logo);
        const tags = (Array.isArray(channel.tags) ? channel.tags : []).slice(0, 3)
            .map(tag => '<span class="watchzone-iptv-tag">' + escapeHtml(tag) + '</span>').join('');
        const initials = escapeHtml(String(channel.name || 'TV').trim().slice(0, 2).toUpperCase());
        return '<button class="watchzone-card watchzone-iptv-card" type="button" data-iptv-channel="' + id + '" aria-label="Watch ' + name + '">' +
            '<div class="watchzone-card-poster"><span class="watchzone-card-type">LIVE</span>' +
            (logo ? '<img class="watchzone-iptv-logo" src="' + escapeHtml(logo) + '" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' : '') +
            '<span class="watchzone-iptv-fallback"' + (logo ? ' hidden' : '') + '>' + initials + '</span></div>' +
            '<div class="watchzone-card-info"><span class="watchzone-card-title">' + name + '</span>' +
            '<span class="watchzone-iptv-tags">' + (tags || '<span class="watchzone-iptv-tag">Live TV</span>') + '</span></div></button>';
    }
    function renderIptvChannels() {
        const query = String(el.searchInput.value || '').trim().toLowerCase();
        const tag = String(el.tagSelect.value || '__all').toLowerCase();
        const filtered = (iptvChannels || []).filter(channel => {
            const tags = Array.isArray(channel.tags) ? channel.tags.map(value => String(value).toLowerCase()) : [];
            const sources = Array.isArray(channel.sources) ? channel.sources.map(source => String(source.name || '').toLowerCase()) : [];
            const matchesTag = tag === '__all' || tags.includes(tag);
            const matchesQuery = !query || String(channel.name || '').toLowerCase().includes(query) ||
                tags.some(value => value.includes(query)) || sources.some(value => value.includes(query));
            return matchesTag && matchesQuery;
        });
        el.home.hidden = true;
        el.results.hidden = false;
        el.resultsEyebrow.textContent = 'LIVE TV';
        el.resultsTitle.textContent = tag === '__all' ? 'IPTV Channels' : tag + ' Channels';
        el.resultsMore.hidden = true;
        el.resultsMoreStatus.textContent = '';
        el.resultsGrid.innerHTML = filtered.length
            ? filtered.map(iptvCardMarkup).join('')
            : '<div class="watchzone-empty">' + (iptvChannels?.length ? 'No channels match this filter.' : 'No channels are available right now.') + '</div>';
        if (iptvChannels && mode === 'iptv') setStatus('', '');
    }
    async function loadIptvChannels(forceRefresh = false) {
        el.home.hidden = true;
        el.results.hidden = false;
        el.resultsEyebrow.textContent = 'LIVE TV';
        el.resultsTitle.textContent = 'IPTV Channels';
        el.resultsMore.hidden = true;
        if (iptvChannels && !forceRefresh) {
            renderIptvTagOptions(iptvChannels);
            renderIptvChannels();
            return;
        }
        const requestId = ++iptvRequest;
        iptvLoading = true;
        setStatus('', '');
        el.resultsGrid.innerHTML = '<div class="watchzone-skeleton"></div><div class="watchzone-skeleton"></div><div class="watchzone-skeleton"></div>';
        try {
            const response = await api.invoke('watch-zone-iptv-channels', Boolean(forceRefresh));
            if (requestId !== iptvRequest || mode !== 'iptv') return;
            if (!response?.success) throw new Error(response?.error || 'IPTV channels could not be loaded.');
            iptvChannels = Array.isArray(response.channels) ? response.channels : [];
            renderIptvTagOptions(iptvChannels);
            renderIptvChannels();
        } catch (error) {
            if (requestId === iptvRequest && mode === 'iptv') {
                el.resultsGrid.innerHTML = '<div class="watchzone-empty">IPTV channels could not load. Use Refresh to try again.</div>';
                setStatus(error.message || 'IPTV channels could not be loaded.', 'error');
            }
        } finally {
            if (requestId === iptvRequest) iptvLoading = false;
        }
    }
    function mediaKey(item) { return `${item.mode || mode}:${item.mediaType || ''}:${item.id}:${Number(item.season) || 0}:${Number(item.episode) || 0}`; }
    function remember(item) {
        const key = mediaKey(item);
        itemCache.set(key, item);
        return key;
    }
    function lookup(key) { return itemCache.get(key); }
    function cardMarkup(item, index = 0, resume = false) {
        const key = remember(item);
        const progress = resume ? item : null;
        const poster = safeImage(item.poster || item.cover || item.banner);
        const badge = item.mode === 'anime' ? 'Anime' : (item.mediaType === 'tv' ? 'Series' : 'Movie');
        const score = Number(item.score) > 0 ? (Number(item.score) / (item.mode === 'anime' ? 10 : 1)).toFixed(1) : '';
        const episodeText = progress?.episode ? `S${progress.season || 1} · E${progress.episode}` : (item.year || item.format || '');
        const percent = progress?.duration ? Math.max(0, Math.min(100, Math.round(100 * progress.position / progress.duration))) : 0;
        return `<button class="watchzone-card" type="button" data-watch-item="${escapeHtml(key)}" data-watch-index="${index}">
            <div class="watchzone-card-poster">${poster ? `<img src="${escapeHtml(poster)}" loading="lazy" onerror="this.style.display='none'">` : ''}<span class="watchzone-card-type">${badge}</span>${score ? `<span class="watchzone-card-rating">★ ${escapeHtml(score)}</span>` : ''}</div>
            <div class="watchzone-card-info"><span class="watchzone-card-title">${escapeHtml(item.title || 'Untitled')}</span><span class="watchzone-card-subtitle">${escapeHtml(episodeText)}</span>${progress ? `<div class="watchzone-progress"><span style="width:${percent}%"></span></div>` : ''}</div>
        </button>`;
    }
    function renderRow(container, items, resume = false) {
        container.innerHTML = '';
        if (!items || !items.length) {
            container.innerHTML = '<div class="watchzone-empty">Nothing to show here yet.</div>';
            return;
        }
        container.innerHTML = items.map((item, index) => cardMarkup(item, index, resume)).join('');
    }
    function continueCardMarkup(item, index = 0) {
        const key = remember(item);
        const progressKey = String(item.key || key);
        const image = safeImage(item.thumbnail || item.still || item.banner || item.poster || item.cover);
        const episodeLabel = item.episodeTitle || (item.episode ? `Season ${item.season || 1} · Episode ${item.episode}` : (item.year || 'Movie'));
        const percent = item.duration ? Math.max(0, Math.min(100, Math.round(100 * item.position / item.duration))) : 0;
        const remaining = item.duration ? `${Math.max(0, Math.ceil((item.duration - item.position) / 60))} min left` : 'Continue watching';
        return `<article class="watchzone-continue-card">
          <button class="watchzone-continue-open" type="button" data-watch-item="${escapeHtml(key)}" data-watch-index="${index}" aria-label="Continue ${escapeHtml(item.title || 'watching')}">
            <span class="watchzone-continue-thumb">${image ? `<img src="${escapeHtml(image)}" loading="lazy" onerror="this.style.display='none'">` : ''}<span class="watchzone-continue-play"><i class="fas fa-play"></i></span><span class="watchzone-continue-progress"><span style="width:${percent}%"></span></span></span>
            <span class="watchzone-continue-copy"><strong>${escapeHtml(item.title || 'Untitled')}</strong><span class="watchzone-continue-episode">${escapeHtml(episodeLabel)}</span><span class="watchzone-continue-time">${escapeHtml(remaining)}</span></span>
          </button>
          <button class="watchzone-continue-remove" type="button" data-watch-remove="${escapeHtml(progressKey)}" aria-label="Remove ${escapeHtml(item.title || 'item')} from Continue Watching"><i class="fas fa-times" aria-hidden="true"></i></button>
        </article>`;
    }
    function heroMarkup(item) {
        if (!item) {
            el.hero.innerHTML = '<div class="watchzone-hero-content"><span class="watchzone-eyebrow">WATCH ZONE</span><h2>Find your next favorite</h2><p>Browse movies, series, and anime from one place.</p></div>';
            el.hero.style.backgroundImage = '';
            return;
        }
        const bg = safeImage(item.banner || item.poster);
        el.hero.style.backgroundImage = bg ? `url("${bg}")` : '';
        const labels = [item.mode === 'anime' ? 'ANIME' : item.mediaType === 'tv' ? 'TV SERIES' : 'MOVIE', item.year, item.format, Number(item.score) > 0 ? `★ ${(Number(item.score) / (item.mode === 'anime' ? 10 : 1)).toFixed(1)}` : ''].filter(Boolean);
        el.hero.innerHTML = `<div class="watchzone-hero-content"><span class="watchzone-eyebrow">${mode === 'anime' ? 'FEATURED ANIME' : 'FEATURED THIS WEEK'}</span><h2>${escapeHtml(item.title)}</h2><div class="watchzone-meta">${labels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div><p>${escapeHtml(item.overview || 'Ready to play in Watch Zone.')}</p><div class="watchzone-hero-actions"><button class="watchzone-primary-button" data-watch-item="${escapeHtml(remember(item))}" type="button"><i class="fas fa-play"></i> Play now</button></div></div>`;
    }
    function showHeroSlide(index) {
        if (!heroSlides.length) { heroMarkup(null); return; }
        heroIndex = (index + heroSlides.length) % heroSlides.length;
        heroMarkup(heroSlides[heroIndex]);
        if (heroSlides.length <= 1) return;
        el.hero.insertAdjacentHTML('beforeend', `<div class="watchzone-hero-navigation" role="group" aria-label="Featured banners"><button type="button" data-hero-step="-1" aria-label="Previous banner">‹</button>${heroSlides.map((item, i) => `<button type="button" data-hero-slide="${i}" class="watchzone-hero-dot ${i === heroIndex ? 'active' : ''}" aria-label="Show ${escapeHtml(item.title)}" aria-current="${i === heroIndex ? 'true' : 'false'}">${i + 1}</button>`).join('')}<button type="button" data-hero-step="1" aria-label="Next banner">›</button></div>`);
    }
    function setHeroSlides(response) {
        clearInterval(heroTimer);
        const seen = new Set();
        heroSlides = [...(response.heroes || []), response.hero, ...(response.primary || []), ...(response.secondary || [])]
            .filter(item => {
                if (!item || !(item.banner || item.poster)) return false;
                const key = `${item.mode || mode}:${item.mediaType || ''}:${item.id}`;
                if (seen.has(key)) return false;
                seen.add(key); return true;
            }).slice(0, 5);
        heroMode = mode;
        showHeroSlide(0);
        if (heroSlides.length > 1) heroTimer = setInterval(() => {
            if (!active || mode !== heroMode || el.home.hidden || document.hidden || heroHovered || el.hero.matches(':focus-within') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            showHeroSlide(heroIndex + 1);
        }, 6500);
    }
    el.hero.addEventListener('mouseenter', () => { heroHovered = true; });
    el.hero.addEventListener('mouseleave', () => { heroHovered = false; });
    el.hero.addEventListener('click', event => {
        const button = event.target.closest('[data-hero-slide], [data-hero-step]');
        if (!button) return;
        showHeroSlide(button.dataset.heroSlide !== undefined ? Number(button.dataset.heroSlide) : heroIndex + Number(button.dataset.heroStep));
        el.hero.querySelector(`[data-hero-slide="${heroIndex}"]`)?.focus({ preventScroll: true });
    });
    async function loadProgress() {
        const response = await api.invoke('watch-zone-state');
        if (!response?.success) return [];
        progressCache.clear();
        for (const item of response.items || []) progressCache.set(item.key, item);
        return (response.items || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    async function loadHome(force = false) {
        if (busy && !force) return;
        if (!force && loadedModes.has(mode) && currentHome?.mode === mode) {
            await refreshContinue();
            return;
        }
        busy = true;
        const requestedMode = mode;
        const requestId = ++latestRequest;
        [el.primary, el.secondary].forEach(container => container.innerHTML = '<div class="watchzone-skeleton"></div><div class="watchzone-skeleton"></div><div class="watchzone-skeleton"></div>');
        try {
            const [response, continueItems] = await Promise.all([api.invoke('watch-zone-home', requestedMode, force), loadProgress()]);
            if (requestId !== latestRequest || requestedMode !== mode) return;
            if (!response?.success) throw new Error(response?.error || 'Catalog could not be loaded.');
            currentHome = response;
            loadedModes.add(mode);
            setHeroSlides(response);
            el.primaryTitle.textContent = response.primaryTitle || (mode === 'anime' ? 'Top Airing' : 'Trending Movies & Shows');
            el.secondaryTitle.textContent = response.secondaryTitle || (mode === 'anime' ? 'Popular Anime' : 'Popular Movies & Shows');
            el.primaryEyebrow.textContent = response.primaryEyebrow || (mode === 'anime' ? 'NEW EPISODES & AIRING PICKS' : 'POPULAR RIGHT NOW');
            el.secondaryEyebrow.textContent = response.secondaryEyebrow || (mode === 'anime' ? 'DISCOVER YOUR NEXT SERIES' : 'PICK YOUR NEXT WATCH');
            renderRow(el.primary, response.primary || []);
            renderRow(el.secondary, response.secondary || []);
            el.secondary.closest('section').hidden = !(response.secondary || []).length;
            renderContinue(continueItems);
            setStatus('');
        } catch (error) {
            if (requestId === latestRequest && requestedMode === mode) {
                el.primary.innerHTML = '<div class="watchzone-empty">Catalog could not load. Use Refresh to try again.</div>';
                el.secondary.innerHTML = '';
                setStatus(error.message || 'Catalog could not be loaded. Use Refresh to try again.', 'error');
            }
        } finally {
            if (requestId === latestRequest) {
                busy = false;
                if (active && requestedMode !== mode && mode !== 'iptv') loadHome(true);
            }
        }
    }
    async function refreshContinue() {
        try { renderContinue(await loadProgress()); } catch (_) {}
    }
    async function removeContinueItem(key) {
        const response = await api.invoke('watch-zone-remove-progress', key);
        if (!response?.success) {
            setStatus('Could not remove that item from Continue Watching.', 'error');
            return;
        }
        setStatus('');
        await refreshContinue();
    }
    async function clearContinueItems() {
        el.continueClear.disabled = true;
        try {
            const response = await api.invoke('watch-zone-clear-progress', mode);
            if (!response?.success) throw new Error('Continue Watching could not be cleared.');
            setStatus('');
            await refreshContinue();
        } catch (error) {
            setStatus(error.message || 'Continue Watching could not be cleared.', 'error');
        } finally { el.continueClear.disabled = false; }
    }
    function renderContinue(items) {
        const filtered = (items || []).filter(item => item.mode === mode && (!item.duration || item.position / item.duration < .97));
        el.continueSection.hidden = filtered.length === 0;
        if (!filtered.length) return;
        el.continueRow.innerHTML = filtered.map(continueCardMarkup).join('');
    }
    function showHome() {
        viewAllState = null;
        el.home.hidden = false;
        el.results.hidden = true;
        el.playback.hidden = true;
        el.view.classList.remove('watchzone-playing');
        syncPlayerBounds();
        refreshContinue();
    }
    function showResults(items, query) {
        viewAllState = null;
        el.home.hidden = true;
        el.results.hidden = false;
        el.resultsEyebrow.textContent = 'SEARCH';
        el.resultsTitle.textContent = query ? `Results for “${query}”` : 'Search Results';
        renderGrid(el.resultsGrid, items || []);
        el.resultsMore.hidden = true;
        el.resultsMoreStatus.textContent = '';
        syncPlayerBounds();
    }
    function renderGrid(container, items) {
        if (!items?.length) {
            container.innerHTML = '<div class="watchzone-empty">No matching titles found.</div>';
            return;
        }
        container.innerHTML = items.map((item, index) => cardMarkup(item, index)).join('');
    }
    function appendCatalogItems(items, state) {
        const markup = [];
        for (const item of items || []) {
            if (!item?.id) continue;
            const key = `${item.mode || state.mode}:${item.mediaType || ''}:${item.id}`;
            if (state.seen.has(key)) continue;
            state.seen.add(key);
            markup.push(cardMarkup({ ...item, mode: item.mode || state.mode }));
        }
        if (markup.length) el.resultsGrid.insertAdjacentHTML('beforeend', markup.join(''));
        return markup.length;
    }
    async function loadMoreViewAll(initial = false) {
        const state = viewAllState;
        if (!state || state.loading || (!initial && !state.hasMore)) return;
        const requestedPage = initial ? 1 : state.page + 1;
        state.loading = true;
        el.resultsMore.hidden = false;
        el.resultsLoadMore.disabled = true;
        el.resultsLoadMore.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading';
        el.resultsMoreStatus.textContent = initial ? 'Loading titles…' : `${state.seen.size} loaded`;
        try {
            const result = await api.invoke('watch-zone-view-all', state.mode, state.section, requestedPage);
            if (viewAllState !== state) return;
            if (!result?.success) throw new Error(result?.error || 'More titles could not be loaded.');
            if (initial) {
                state.seen.clear();
                el.resultsGrid.innerHTML = '';
            }
            const added = appendCatalogItems(result.items || [], state);
            state.page = requestedPage;
            state.hasMore = Boolean(result.hasMore) && (result.items || []).length > 0;
            state.loading = false;
            el.resultsMoreStatus.textContent = state.hasMore ? `${state.seen.size} loaded` : `${state.seen.size} titles · end of list`;
            el.resultsLoadMore.hidden = !state.hasMore;
            el.resultsLoadMore.disabled = false;
            el.resultsLoadMore.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Load more';
            if (!state.seen.size) el.resultsGrid.innerHTML = '<div class="watchzone-empty">No titles are available in this list.</div>';
            else if (!added && !state.hasMore) el.resultsMoreStatus.textContent = `${state.seen.size} titles · end of list`;
        } catch (error) {
            if (viewAllState !== state) return;
            state.loading = false;
            el.resultsMoreStatus.textContent = error.message || 'More titles could not be loaded.';
            el.resultsLoadMore.disabled = false;
            el.resultsLoadMore.innerHTML = '<i class="fas fa-rotate-right" aria-hidden="true"></i> Retry';
            el.resultsLoadMore.hidden = false;
        }
    }
    async function openViewAll(section, refresh = false) {
        if (!currentHome || currentHome.mode !== mode || !['primary', 'secondary'].includes(section)) return;
        activeSearch = '';
        el.searchInput.value = '';
        const title = section === 'primary' ? el.primaryTitle.textContent : el.secondaryTitle.textContent;
        const state = { mode, section, title, page: refresh ? 0 : 1, hasMore: true, loading: false, seen: new Set() };
        if (mode === 'cartoon' && !refresh) state.page = 0;
        viewAllState = state;
        el.home.hidden = true;
        el.results.hidden = false;
        el.resultsEyebrow.textContent = mode === 'anime' ? 'ANIME CATALOG' : 'MOVIE & TV CATALOG';
        el.resultsTitle.textContent = title;
        el.resultsGrid.innerHTML = '';
        el.resultsMore.hidden = false;
        el.resultsLoadMore.hidden = false;
        el.resultsLoadMore.disabled = false;
        el.resultsLoadMore.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Load more';
        el.resultsMoreStatus.textContent = '';
        if (!refresh) {
            const firstPage = section === 'primary' ? currentHome.primary : currentHome.secondary;
            appendCatalogItems(firstPage || [], state);
            el.resultsMoreStatus.textContent = `${state.seen.size} loaded`;
            if (!state.seen.size) await loadMoreViewAll(true);
        } else {
            await loadMoreViewAll(true);
        }
        if (viewAllState === state && !state.hasMore) el.resultsLoadMore.hidden = true;
        if (el.scrollArea) el.scrollArea.scrollTop = 0;
        syncPlayerBounds();
    }
    async function search() {
        const query = el.searchInput.value.trim();
        if (mode === 'iptv') {
            activeSearch = query;
            renderIptvChannels();
            return;
        }
        if (!query) return;
        busy = false;
        activeSearch = query;
        const requestId = ++latestRequest;
        setStatus('Searching…', 'loading');
        try {
            const result = await api.invoke('watch-zone-search', mode, query);
            if (requestId !== latestRequest) return;
            if (!result?.success) throw new Error(result?.error || 'Search is temporarily unavailable.');
            (result.items || []).forEach(item => { item.mode = mode; });
            showResults(result.items || [], query);
            setStatus('');
        } catch (error) {
            if (requestId === latestRequest) setStatus(error.message || 'Search is temporarily unavailable.', 'error');
        }
    }
    function isSeries(item) { return item?.mode === 'anime' || item?.mode === 'cartoon' || item?.mediaType === 'tv'; }
    function exactEpisodeNumber(query) {
        const match = String(query || '').trim().match(/^(?:(?:episode|episodes|ep|e)\s*)?#?\s*(\d+)$/i);
        const number = match ? Number(match[1]) : 0;
        return Number.isInteger(number) && number > 0 && number <= 5000 ? number : 0;
    }
    function expandAnimeEpisodesForSearch(query) {
        if (currentMedia?.mode !== 'anime') return;
        const target = exactEpisodeNumber(query);
        const knownCount = Number(currentMedia.episodeCount) || 0;
        if (!target || target <= episodes.length || target > 5000 || (knownCount > 0 && target > knownCount)) return;
        for (let number = episodes.length + 1; number <= target; number++) episodes.push({ number, title: `Episode ${number}` });
    }
    function renderEpisodeList() {
        if (!currentMedia || !isSeries(currentMedia)) {
            el.episodeBrowser.hidden = true;
            return;
        }
        el.episodeBrowser.hidden = false;
        el.episodeSearch.disabled = episodeLoading;
        const isTv = currentMedia.mode === 'movie' && currentMedia.mediaType === 'tv';
        el.episodeCount.textContent = episodeLoading
            ? 'Loading…'
            : (isTv
                ? `${episodes.length} in season ${selectedSeason}`
                : (currentMedia.mode === 'anime' && currentMedia.status === 'RELEASING'
                    ? `${episodes.length} aired ${episodes.length === 1 ? 'episode' : 'episodes'}`
                    : `${episodes.length} episodes`));
        if (episodeLoading) {
            el.episodeList.innerHTML = '<div class="watchzone-episode-empty">Loading episode guide…</div>';
            el.episodePagination.hidden = true;
            el.episodePageInfo.textContent = '';
            return;
        }
        expandAnimeEpisodesForSearch(episodeSearchQuery);
        const query = episodeSearchQuery.trim().toLowerCase();
        const exact = exactEpisodeNumber(query);
        const filtered = exact
            ? episodes.filter(episode => Number(episode.number) === exact)
            : (query ? episodes.filter(episode => `episode ${episode.number} ${episode.title || ''} ${episode.overview || ''} ${episode.number}`.toLowerCase().includes(query)) : episodes);
        const pageCount = Math.max(1, Math.ceil(filtered.length / episodesPerPage));
        episodePage = Math.max(1, Math.min(episodePage, pageCount));
        const start = (episodePage - 1) * episodesPerPage;
        const pageItems = filtered.slice(start, start + episodesPerPage);
        if (!pageItems.length) {
            el.episodeList.innerHTML = `<div class="watchzone-episode-empty">${episodes.length ? 'No episodes match that search.' : 'No episodes are available for this season.'}</div>`;
        } else {
            el.episodeList.innerHTML = pageItems.map(episode => {
                const number = Number(episode.number) || 0;
                const thumb = safeImage(episode.still || currentMedia.banner || currentMedia.poster || currentMedia.cover);
                const isAnime = currentMedia.mode === 'anime';
                const title = episode.title || `Episode ${number}`;
                const detail = currentMedia.mode === 'cartoon' ? `Cartoon · Episode ${number}` : isAnime ? (currentMedia.format || 'Anime episode') : `Season ${selectedSeason} · Episode ${number}`;
                return `<button class="watchzone-episode-button ${number === selectedEpisode ? 'active' : ''}" type="button" role="listitem" data-watch-episode="${number}" aria-label="Play ${escapeHtml(title)}">
                    <span class="watchzone-episode-thumb">${thumb ? `<img src="${escapeHtml(thumb)}" loading="lazy" onerror="this.style.display='none'">` : ''}<span>E${number}</span></span>
                    <span class="watchzone-episode-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></span>
                    <span class="watchzone-episode-action" aria-hidden="true"><i class="fas fa-play"></i></span>
                </button>`;
            }).join('');
        }
        el.episodePagination.hidden = filtered.length <= episodesPerPage;
        el.episodePagePrevious.disabled = episodePage <= 1;
        el.episodePageNext.disabled = episodePage >= pageCount;
        el.episodePageInfo.textContent = filtered.length ? `${start + 1}–${Math.min(start + episodesPerPage, filtered.length)} of ${filtered.length}` : '0 episodes';
        el.episodeList.querySelectorAll('[data-watch-episode]').forEach(button => button.addEventListener('click', () => {
            selectedEpisode = Number(button.dataset.watchEpisode) || 1;
            applySelectedEpisodeArtwork();
            updatePlayerSubtitle();
            renderSeriesControls();
            startPlayback();
        }));
    }
    function renderSeriesControls() {
        if (!currentMedia || !isSeries(currentMedia)) {
            el.seriesControls.hidden = true;
            el.episodeBrowser.hidden = true;
            return;
        }
        el.seriesControls.hidden = currentMedia.mode === 'cartoon';
        const isTv = currentMedia.mode === 'movie' && currentMedia.mediaType === 'tv';
        el.seasonWrap.hidden = !isTv;
        el.audioWrap.hidden = currentMedia.mode !== 'anime';
        el.episodeSearch.placeholder = isTv ? 'Search episodes in this season' : 'Search episodes or enter a number';
        el.seasonSelect.innerHTML = seasons.map(season => `<option value="${Number(season.number)}" ${Number(season.number) === selectedSeason ? 'selected' : ''}>${escapeHtml(season.name || `Season ${season.number}`)}</option>`).join('') || '<option value="1">Season 1</option>';
        el.audioSelect.value = activeAudio;
        syncWatchDropdown(watchDropdowns[1]);
        syncWatchDropdown(watchDropdowns[2]);
        renderEpisodeList();
    }
    function updatePlayerSubtitle() {
        if (currentMedia?.mode === 'iptv') {
            const tags = Array.isArray(currentMedia.tags) ? currentMedia.tags.slice(0, 3).join(' · ') : '';
            el.playerSubtitle.textContent = tags || 'Live television';
            return;
        }
        const meta = [currentMedia?.mode === 'cartoon' ? 'Cartoon series' : currentMedia?.mode === 'anime' ? 'Anime' : currentMedia?.mediaType === 'tv' ? 'TV series' : 'Movie', currentMedia?.year].filter(Boolean);
        if (currentMedia?.mode === 'anime') meta.push(`Episode ${selectedEpisode}`);
        else if (currentMedia?.mode === 'cartoon') meta.push(`Episode ${selectedEpisode}`);
        else if (currentMedia?.mediaType === 'tv') meta.push(`Season ${selectedSeason} · Episode ${selectedEpisode}`);
        el.playerSubtitle.textContent = meta.join('  ·  ');
    }
    function applySelectedEpisodeArtwork() {
        if (!currentMedia || !isSeries(currentMedia)) return;
        const episode = episodes.find(item => Number(item.number) === selectedEpisode);
        if (episode?.title) currentMedia.episodeTitle = episode.title;
        currentMedia.thumbnail = episode?.still || currentMedia.thumbnail || currentMedia.banner || currentMedia.poster || '';
    }
    async function syncPlayerArtwork(media) {
        if (!media || media !== currentMedia) return;
        await api.invoke('watch-zone-player-metadata', {
            mode: media.mode, id: media.id, season: selectedSeason, episode: selectedEpisode,
            thumbnail: media.thumbnail || media.banner || media.poster || '', episodeTitle: media.episodeTitle || '', episodeNavigation: getEpisodeNavigation()
        }).catch(() => {});
    }
    async function loadEpisodeData(playerStartPromise) {
        if (!currentMedia || !isSeries(currentMedia)) return;
        const mediaAtRequest = currentMedia;
        if (mediaAtRequest.mode === 'cartoon') {
            const response = await api.invoke('watch-zone-cartoon-episodes', mediaAtRequest.slug).catch(error => ({ error: error.message }));
            if (mediaAtRequest !== currentMedia) return;
            episodeLoading = false;
            episodes = response?.success ? response.episodes : [];
            applySelectedEpisodeArtwork();
            renderSeriesControls();
            if (!response?.success) setPlaybackStatus(response?.error || 'Episode guide unavailable.', 'error');
            await playerStartPromise;
            await syncPlayerArtwork(mediaAtRequest);
            return;
        }
        if (mediaAtRequest.mode === 'anime') {
            const response = await api.invoke('watch-zone-anime-episodes', mediaAtRequest.id).catch(() => null);
            if (mediaAtRequest !== currentMedia) return;
            const episodeMetadata = response?.success && Array.isArray(response.episodes) ? response.episodes : [];
            const metadataByNumber = new Map(episodeMetadata.map(episode => [Number(episode.number), episode]).filter(([number]) => Number.isInteger(number) && number > 0));
            const highestMetadataEpisode = Math.max(0, ...metadataByNumber.keys());
            if (response?.status) mediaAtRequest.status = String(response.status);
            if (Number(response?.nextAiringEpisode) > 0) mediaAtRequest.nextEpisode = Number(response.nextAiringEpisode);
            const responseCount = Number(response?.airedEpisodeCount || response?.episodeCount) || 0;
            const airingFallback = mediaAtRequest.status === 'RELEASING' && Number(mediaAtRequest.nextEpisode) > 0
                ? Math.max(1, Number(mediaAtRequest.nextEpisode) - 1)
                : 0;
            const fallbackCount = mediaAtRequest.status === 'RELEASING'
                ? (airingFallback || highestMetadataEpisode || 1)
                : (Number(mediaAtRequest.episodeCount) || highestMetadataEpisode || 1);
            const total = Math.max(1, Math.min(5000, responseCount || fallbackCount));
            mediaAtRequest.episodeCount = total;
            const clampedEpisode = Math.max(1, Math.min(total, Number(selectedEpisode) || 1));
            const episodeWasClamped = clampedEpisode !== selectedEpisode;
            selectedEpisode = clampedEpisode;
            episodes = Array.from({ length: total }, (_, index) => metadataByNumber.get(index + 1) || { number: index + 1, title: `Episode ${index + 1}` });
            episodeLoading = false;
            applySelectedEpisodeArtwork();
            renderSeriesControls();
            updatePlayerSubtitle();
            await (episodeWasClamped ? startPlayback() : playerStartPromise);
            await syncPlayerArtwork(mediaAtRequest);
            return;
        }
        try {
            const detailResponse = await api.invoke('watch-zone-details', 'movie', mediaAtRequest.id, 'tv');
            if (mediaAtRequest !== currentMedia) return;
            if (!detailResponse?.success) throw new Error(detailResponse?.error || 'TV details are unavailable.');
            seasons = Array.isArray(detailResponse.item?.seasons) ? detailResponse.item.seasons : [];
            let selectionChanged = false;
            if (!seasons.some(season => Number(season.number) === selectedSeason)) selectedSeason = Number(seasons[0]?.number) || 1;
            if ((Number(mediaAtRequest.season) || 1) !== selectedSeason) selectionChanged = true;
            const response = await api.invoke('watch-zone-episodes', mediaAtRequest.id, selectedSeason);
            if (mediaAtRequest !== currentMedia) return;
            if (!response?.success) throw new Error(response?.error || 'Episode list could not be loaded.');
            episodes = response.episodes || [];
            if (episodes.length && !episodes.some(episode => Number(episode.number) === selectedEpisode)) {
                selectedEpisode = Number(episodes[0].number) || 1;
                selectionChanged = true;
            }
            episodeLoading = false;
            applySelectedEpisodeArtwork();
            renderSeriesControls();
            updatePlayerSubtitle();
            if (selectionChanged) await startPlayback();
            else await playerStartPromise;
            await syncPlayerArtwork(mediaAtRequest);
        } catch (error) {
            if (mediaAtRequest === currentMedia) {
                episodeLoading = false;
                renderSeriesControls();
                setPlaybackStatus(error.message || 'Episode list is unavailable.', 'error');
            }
        }
    }
    async function openPlayer(item, resume = false) {
        if (!item) return;
        const resolvedMode = item.mode || mode;
        if (resolvedMode !== mode) {
            mode = resolvedMode;
            toggleModeButtons();
        }
        browseReturn = {
            page: el.results.hidden ? 'home' : 'results',
            scrollTop: el.scrollArea?.scrollTop || 0
        };
        currentMedia = { ...item, mode: resolvedMode, thumbnail: item.thumbnail || item.still || item.banner || item.poster || '' };
        seasons = [];
        episodes = [];
        selectedSeason = Number(item.season) || 1;
        selectedEpisode = Number(item.episode) || 1;
        if (resolvedMode === 'anime' && item.status === 'RELEASING' && Number(item.nextEpisode) > 0) {
            selectedEpisode = Math.max(1, Math.min(selectedEpisode, Number(item.nextEpisode) - 1));
        }
        currentMedia.episode = selectedEpisode;
        availableSources = [];
        selectedSourceIndex = null;
        el.sourceSelect.innerHTML = '';
        syncWatchDropdown(watchDropdowns[0]);
        el.sourceWrap.hidden = true;
        episodePage = 1;
        episodeSearchQuery = '';
        episodeLoading = isSeries(currentMedia);
        el.episodeSearch.value = '';
        activeAudio = 'sub';
        resumeOnStart = Boolean(resume && Number(item.position) > 0);
        playerStarted = false;
        el.home.hidden = true;
        el.results.hidden = true;
        el.playback.hidden = false;
        el.view.classList.add('watchzone-playing');
        el.playerTitle.textContent = item.title || 'Watch Zone';
        el.playerEyebrow.textContent = resolvedMode === 'cartoon' ? 'TOP CARTOONS PLAYER' : resolvedMode === 'anime' ? 'ANIME PLAYER' : (item.mediaType === 'tv' ? 'TV PLAYER' : 'MOVIE PLAYER');
        updatePlayerSubtitle();
        setPlaybackStatus('');
        el.playerHost.innerHTML = '<div class="watchzone-player-placeholder"><div><i class="fas fa-spinner fa-spin"></i>Starting playback…</div></div>';
        renderSeriesControls();
        requestAnimationFrame(() => { el.playback.scrollTop = 0; if (el.scrollArea) el.scrollArea.scrollTop = 0; syncPlayerBounds(); });

        // Start from the selected item immediately; metadata/episode menus load independently.
        const initialPlayback = startPlayback();
        loadEpisodeData(initialPlayback);
    }
    function openIptvPlayer(channel) {
        if (!channel) return;
        browseReturn = { page: 'iptv', scrollTop: el.scrollArea?.scrollTop || 0 };
        currentMedia = {
            ...channel, mode: 'iptv', id: channel.id || channel.name,
            title: channel.name || 'Live channel', thumbnail: channel.logo || ''
        };
        availableSources = [];
        selectedSourceIndex = null;
        selectedVariantIndex = 0;
        availableVariants = [];
        el.sourceSelect.innerHTML = '';
        el.variantSelect.innerHTML = '';
        syncWatchDropdown(watchDropdowns[0]);
        syncWatchDropdown(watchDropdowns[4]);
        el.sourceWrap.hidden = true;
        el.variantWrap.hidden = true;
        el.seriesControls.hidden = true;
        el.seasonWrap.hidden = true;
        el.audioWrap.hidden = true;
        el.episodeBrowser.hidden = true;
        resumeOnStart = false;
        playerStarted = false;
        renderSourceOptions((channel.sources || []).map(source => ({
            index: Number(source.serverIndex) || 0, label: source.name || channel.name, quality: ''
        })), 0);
        el.home.hidden = true;
        el.results.hidden = true;
        el.playback.hidden = false;
        el.view.classList.add('watchzone-playing');
        el.playerTitle.textContent = currentMedia.title;
        el.playerEyebrow.textContent = 'IPTV CHANNEL';
        updatePlayerSubtitle();
        setPlaybackStatus('');
        el.playerHost.innerHTML = '<div class="watchzone-player-placeholder"><div><i class="fas fa-spinner fa-spin"></i>Starting live stream…</div></div>';
        requestAnimationFrame(() => { el.playback.scrollTop = 0; if (el.scrollArea) el.scrollArea.scrollTop = 0; syncPlayerBounds(); });
        startPlayback();
    }
    async function startPlayback(forceResume = false) {
        if (!currentMedia) return;
        const requestId = ++playbackRequest;
        playerStarted = true;
        const resumePosition = (forceResume || resumeOnStart) ? Number(currentMedia.position) || 0 : 0;
        resumeOnStart = false;
        const payload = {
            mode: currentMedia.mode, id: currentMedia.id, mediaType: currentMedia.mediaType, slug: currentMedia.slug,
            season: selectedSeason, episode: selectedEpisode, audio: activeAudio, episodeNavigation: getEpisodeNavigation(),
            sourceIndex: selectedSourceIndex, variantIndex: selectedVariantIndex, channelName: currentMedia.mode === 'iptv' ? currentMedia.name : '',
            startPosition: resumePosition,
            title: currentMedia.title, poster: currentMedia.poster, banner: currentMedia.banner,
            titleEnglish: currentMedia.titleEnglish, titleRomaji: currentMedia.titleRomaji,
            synonyms: currentMedia.synonyms, malId: currentMedia.malId,
            thumbnail: currentMedia.thumbnail, episodeTitle: currentMedia.episodeTitle
        };
        el.playerHost.innerHTML = '<div class="watchzone-player-placeholder"><div><i class="fas fa-spinner fa-spin"></i>Resolving source and opening in-app player…</div></div>';
        setPlaybackStatus('Connecting to the selected source…', 'loading');
        requestAnimationFrame(syncPlayerBounds);
        try {
            const result = await api.invoke('watch-zone-play', payload);
            if (requestId !== playbackRequest) return;
            if (!result?.success) throw new Error(result?.error || 'Playback could not be started.');
            renderSourceOptions(result.sources, result.selectedSourceIndex);
            renderVariantOptions(result.variants, result.selectedVariantIndex);
            setPlaybackStatus(`Playing · ${result.server || 'Auto source'}`);
            requestAnimationFrame(syncPlayerBounds);
            return result;
        } catch (error) {
            if (requestId !== playbackRequest) return;
            el.sourceSelect.disabled = availableSources.length <= 1;
            syncWatchDropdown(watchDropdowns[0]);
            playerStarted = false;
            setPlaybackStatus('');
            renderPlaybackError(error);
            syncPlayerBounds();
            return { success: false, error: error.message };
        }
    }
    async function reloadCurrentEpisode() {
        if (!currentMedia) return;
        if (currentMedia.mode === 'iptv') {
            startPlayback();
            return;
        }
        try {
            const isEpisodic = isSeries(currentMedia);
            const key = `${currentMedia.mode}:${currentMedia.id}:${isEpisodic ? selectedSeason : 0}:${isEpisodic ? selectedEpisode : 0}`;
            const state = await api.invoke('watch-zone-state');
            const saved = (state?.items || []).find(item => item.key === key);
            currentMedia.position = Number(saved?.position) || 0;
        } catch (_) { currentMedia.position = Number(currentMedia.position) || 0; }
        startPlayback(true);
    }
    async function backToBrowse() {
        playbackRequest++;
        playerStarted = false;
        await api.invoke('watch-zone-player-close').catch(() => {});
        el.playback.hidden = true;
        el.view.classList.remove('watchzone-playing');
        const page = browseReturn?.page || 'home';
        el.home.hidden = page !== 'home';
        el.results.hidden = page !== 'results' && page !== 'iptv';
        if (page === 'iptv') renderIptvChannels();
        requestAnimationFrame(() => {
            if (el.scrollArea) el.scrollArea.scrollTop = browseReturn?.scrollTop || 0;
            syncPlayerBounds();
        });
        browseReturn = null;
        refreshContinue();
    }
    function syncPlayerBounds() {
        if (!api) return;
        if (!el.playback.hidden && active && el.playback.clientHeight > 0) {
            // Use the unscrolled slot position so episode scrolling never resizes video.
            const pageRect = el.playback.getBoundingClientRect();
            const slotRect = el.playerHost.getBoundingClientRect();
            const offset = slotRect.top - pageRect.top + el.playback.scrollTop;
            const padding = parseFloat(getComputedStyle(el.playback).paddingBottom) || 0;
            const height = Math.max(180, Math.floor(el.playback.clientHeight - offset - padding));
            const value = `${height}px`;
            if (el.playerHost.style.getPropertyValue('--watchzone-player-height') !== value) {
                el.playerHost.style.setProperty('--watchzone-player-height', value);
            }
        }
        if (!playerStarted || watchDropdownOpen || el.playback.hidden || !active || !el.view.classList.contains('active-view')) {
            api.invoke('watch-zone-player-layout', { visible: false }).catch(() => {});
            return;
        }
        const rect = el.playerHost.getBoundingClientRect();
        const clip = el.view.getBoundingClientRect();
        const left = Math.max(0, clip.left, rect.left);
        const top = Math.max(0, clip.top, rect.top);
        const right = Math.min(window.innerWidth, clip.right, rect.right);
        const bottom = Math.min(window.innerHeight, clip.bottom, rect.bottom);
        api.invoke('watch-zone-player-layout', {
            x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top),
            visible: right - left > 60 && bottom - top > 60
        }).catch(() => {});
    }
    function setActive(isActive) {
        active = Boolean(isActive);
        if (active) {
            toggleModeButtons();
            if (mode === 'iptv') loadIptvChannels(false);
            else loadHome(false);
        } else syncPlayerBounds();
        requestAnimationFrame(syncPlayerBounds);
    }
    function refreshCurrentPage() {
        if (el.scrollArea) el.scrollArea.scrollTop = 0;
        if (mode === 'iptv') {
            activeSearch = el.searchInput.value.trim();
            loadIptvChannels(true);
            return;
        }
        if (!el.results.hidden && viewAllState) {
            openViewAll(viewAllState.section, true);
            return;
        }
        if (!el.results.hidden && activeSearch) {
            el.searchInput.value = activeSearch;
            search();
            return;
        }
        activeSearch = '';
        el.searchInput.value = '';
        el.results.hidden = true;
        el.home.hidden = false;
        loadedModes.delete(mode);
        loadHome(true);
    }
    document.querySelectorAll('[data-watch-mode]').forEach(button => button.addEventListener('click', () => {
        const nextMode = button.dataset.watchMode;
        if (!['movie', 'anime', 'iptv', 'cartoon'].includes(nextMode) || nextMode === mode) return;
        const catalogInFlight = busy;
        mode = nextMode;
        if (!catalogInFlight) latestRequest++;
        iptvRequest++;
        currentHome = null;
        activeSearch = '';
        viewAllState = null;
        el.searchInput.value = '';
        toggleModeButtons();
        setStatus('');
        if (mode === 'iptv') {
            el.home.hidden = true;
            el.results.hidden = false;
            loadIptvChannels(false);
        } else {
            el.home.hidden = false;
            el.results.hidden = true;
            if (!catalogInFlight) loadHome(true);
        }
        if (el.scrollArea) el.scrollArea.scrollTop = 0;
    }));
    el.searchForm.addEventListener('submit', event => { event.preventDefault(); search(); });
    el.searchInput.addEventListener('input', () => {
        if (mode === 'iptv' && iptvChannels) {
            activeSearch = el.searchInput.value.trim();
            renderIptvChannels();
        }
    });
    el.tagSelect.addEventListener('change', event => {
        syncWatchDropdown(watchDropdowns[3]);
        selectedIptvTag = event.target.value || '__all';
        renderIptvChannels();
    });
    el.refresh.addEventListener('click', refreshCurrentPage);
    el.primaryViewAll.addEventListener('click', () => openViewAll('primary'));
    el.secondaryViewAll.addEventListener('click', () => openViewAll('secondary'));
    el.resultsLoadMore.addEventListener('click', () => loadMoreViewAll(false));
    el.continueClear.addEventListener('click', clearContinueItems);
    el.backHome.addEventListener('click', () => {
        if (mode === 'iptv') {
            activeSearch = '';
            el.searchInput.value = '';
            loadIptvChannels(false);
            if (el.scrollArea) el.scrollArea.scrollTop = 0;
            return;
        }
        activeSearch = '';
        viewAllState = null;
        el.searchInput.value = '';
        showHome();
        if (el.scrollArea) el.scrollArea.scrollTop = 0;
    });
    el.playerBack.addEventListener('click', backToBrowse);
    el.playerRefresh.addEventListener('click', reloadCurrentEpisode);
    el.sourceSelect.addEventListener('change', async event => {
        syncWatchDropdown(watchDropdowns[0]);
        const nextIndex = Number(event.target.value);
        if (!Number.isInteger(nextIndex) || nextIndex === selectedSourceIndex || !currentMedia) return;
        const mediaAtRequest = currentMedia;
        const previousSourceIndex = selectedSourceIndex;
        el.sourceSelect.disabled = true;
        syncWatchDropdown(watchDropdowns[0]);
        const selected = availableSources.find(source => Number(source.index) === nextIndex);
        if (currentMedia.mode === 'iptv') {
            selectedSourceIndex = nextIndex;
            resumeOnStart = false;
            const switched = await startPlayback();
            if (!switched?.success && mediaAtRequest === currentMedia && previousSourceIndex !== null) {
                selectedSourceIndex = previousSourceIndex;
                el.sourceSelect.value = String(previousSourceIndex);
                syncWatchDropdown(watchDropdowns[0]);
            }
            return;
        }
        setPlaybackStatus(`Switching to ${selected?.label || 'selected source'}…`, 'loading');
        const progress = await api.invoke('watch-zone-player-position').catch(() => null);
        if (mediaAtRequest !== currentMedia || Number(el.sourceSelect.value) !== nextIndex) return;
        if (progress?.success) {
            currentMedia.position = Number(progress.position) || 0;
            currentMedia.duration = Number(progress.duration) || 0;
        }
        selectedSourceIndex = nextIndex;
        resumeOnStart = true;
        const switched = await startPlayback(true);
        if (!switched?.success && mediaAtRequest === currentMedia && previousSourceIndex !== null) {
            selectedSourceIndex = previousSourceIndex;
            el.sourceSelect.value = String(previousSourceIndex);
            syncWatchDropdown(watchDropdowns[0]);
        }
    });
    el.variantSelect.addEventListener('change', async event => {
        syncWatchDropdown(watchDropdowns[4]);
        const nextIndex = Number(event.target.value);
        if (!Number.isInteger(nextIndex) || nextIndex === selectedVariantIndex || currentMedia?.mode !== 'iptv') return;
        const previousIndex = selectedVariantIndex;
        selectedVariantIndex = nextIndex;
        const switched = await startPlayback();
        if (!switched?.success && currentMedia?.mode === 'iptv') {
            selectedVariantIndex = previousIndex;
            el.variantSelect.value = String(previousIndex);
            syncWatchDropdown(watchDropdowns[4]);
        }
    });
    el.seasonSelect.addEventListener('change', async event => {
        syncWatchDropdown(watchDropdowns[1]);
        selectedSeason = Number(event.target.value) || 1;
        selectedEpisode = 1;
        episodePage = 1;
        episodeSearchQuery = '';
        el.episodeSearch.value = '';
        episodes = [];
        episodeLoading = true;
        renderSeriesControls();
        updatePlayerSubtitle();
        setPlaybackStatus('Loading season episodes…', 'loading');
        const mediaAtRequest = currentMedia;
        const requestedSeason = selectedSeason;
        const response = await api.invoke('watch-zone-episodes', mediaAtRequest.id, requestedSeason);
        if (mediaAtRequest !== currentMedia || requestedSeason !== selectedSeason) return;
        if (!response?.success) {
            episodeLoading = false;
            renderSeriesControls();
            setPlaybackStatus(response?.error || 'Could not load this season.', 'error');
            return;
        }
        episodes = response.episodes || [];
        episodeLoading = false;
        if (episodes.length) {
            selectedEpisode = Number(episodes[0].number) || 1;
            applySelectedEpisodeArtwork();
            updatePlayerSubtitle();
        }
        setPlaybackStatus('');
        renderSeriesControls();
        if (episodes.length) {
            await startPlayback();
            await syncPlayerArtwork(mediaAtRequest);
        }
    });
    el.episodeSearch.addEventListener('input', event => {
        episodeSearchQuery = event.target.value;
        episodePage = 1;
        renderEpisodeList();
    });
    el.episodePagePrevious.addEventListener('click', () => { episodePage = Math.max(1, episodePage - 1); renderEpisodeList(); });
    el.episodePageNext.addEventListener('click', () => { episodePage++; renderEpisodeList(); });
    el.audioSelect.addEventListener('change', event => { syncWatchDropdown(watchDropdowns[2]); activeAudio = event.target.value === 'dub' ? 'dub' : 'sub'; applySelectedEpisodeArtwork(); reloadCurrentEpisode(); });
    el.continueRow.addEventListener('click', event => {
        const remove = event.target.closest('[data-watch-remove]');
        if (remove) {
            event.preventDefault();
            event.stopPropagation();
            removeContinueItem(remove.dataset.watchRemove);
            return;
        }
        const button = event.target.closest('[data-watch-item]');
        if (!button) return;
        const item = lookup(button.dataset.watchItem);
        if (item) openPlayer(item, true);
    });
    el.resultsGrid.addEventListener('click', event => {
        const button = event.target.closest('[data-iptv-channel]');
        if (!button || mode !== 'iptv') return;
        const channel = (iptvChannels || []).find(item => String(item.id || item.name) === button.dataset.iptvChannel);
        if (channel) openIptvPlayer(channel);
    });
    [el.primary, el.secondary, el.resultsGrid, el.hero].forEach(container => {
        container.addEventListener('click', event => {
            const button = event.target.closest('[data-watch-item]');
            if (!button) return;
            const item = lookup(button.dataset.watchItem);
            if (item) openPlayer(item, container === el.continueRow);
        });
    });
    window.addEventListener('resize', syncPlayerBounds);
    el.scrollArea?.addEventListener('scroll', () => {
        syncPlayerBounds();
        if (viewAllState && !viewAllState.loading && viewAllState.hasMore && !el.results.hidden) {
            const rect = el.results.getBoundingClientRect();
            if (rect.bottom - window.innerHeight < 340) loadMoreViewAll(false);
        }
    }, { passive: true });
    el.playback?.addEventListener('scroll', syncPlayerBounds, { passive: true });
    function getEpisodeNavigation() {
        const numbers = [...new Set(episodes.map(item => Number(item.number)).filter(number => Number.isInteger(number) && number > 0))].sort((a, b) => a - b);
        const index = numbers.indexOf(selectedEpisode);
        return { enabled: isSeries(currentMedia) && !episodeLoading && numbers.length > 1, count: numbers.length, previous: index > 0 ? numbers[index - 1] : 0, next: index >= 0 && index < numbers.length - 1 ? numbers[index + 1] : 0 };
    }
    api.on('watch-zone-episode-step', async target => {
        if (!currentMedia || el.playback.hidden || target.mode !== currentMedia.mode || Number(target.id) !== Number(currentMedia.id) || Number(target.fromEpisode) !== selectedEpisode || Number(target.season) !== selectedSeason) return;
        const nextEpisode = Number(target.episode);
        if (!episodes.some(item => Number(item.number) === nextEpisode)) return;
        selectedEpisode = nextEpisode;
        resumeOnStart = false;
        applySelectedEpisodeArtwork();
        updatePlayerSubtitle();
        renderSeriesControls();
        await startPlayback();
    });
    api.on('watch-zone-scroll', deltaY => {
        if (!el.playback.hidden && !watchDropdownOpen) el.playback.scrollTop += Number(deltaY) || 0;
    });
    document.addEventListener('visibilitychange', syncPlayerBounds);
    if (window.ResizeObserver) {
        const observer = new ResizeObserver(syncPlayerBounds);
        observer.observe(el.view);
        observer.observe(el.playback);
        observer.observe(el.playerHost);
    }
    window.watchZoneApp = { setActive };
})();
