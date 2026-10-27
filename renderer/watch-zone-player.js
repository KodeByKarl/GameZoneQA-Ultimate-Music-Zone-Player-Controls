(() => {
    'use strict';

    const bridge = window.watchZonePlayerBridge;
    const playerRoot = document.getElementById('playerRoot');
    const video = document.getElementById('watchVideo');
    const frame = document.getElementById('watchEmbed');
    const stage = document.getElementById('playerStage');
    const message = document.getElementById('playerMessage');
    const title = document.getElementById('playerTitle');
    const qualityLabel = document.getElementById('playerQuality');
    const qualitySelect = document.getElementById('qualitySelect');
    const subtitleSelect = document.getElementById('subtitleSelect');
    const displaySelect = document.getElementById('displaySelect');
    const displayButton = document.getElementById('displayDropdownButton');
    const displayLabel = document.getElementById('displayDropdownLabel');
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    const previousEpisodeButton = document.getElementById('playerPreviousEpisode');
    const nextEpisodeButton = document.getElementById('playerNextEpisode');
    function updateEpisodeNavigation(state = {}) {
        previousEpisodeButton.hidden = nextEpisodeButton.hidden = !state.enabled;
        previousEpisodeButton.disabled = !state.enabled || !state.previous;
        nextEpisodeButton.disabled = !state.enabled || !state.next;
    }
    bridge?.onEpisodeNavigation?.(updateEpisodeNavigation);
    [[previousEpisodeButton, -1], [nextEpisodeButton, 1]].forEach(([button, direction]) => {
        button.addEventListener('click', () => {
            if (button.disabled) return;
            previousEpisodeButton.disabled = nextEpisodeButton.disabled = true;
            bridge?.episodeStep?.(direction);
        });
    });
    const qualityDropdown = {
        root: document.getElementById('qualityDropdown'),
        button: document.getElementById('qualityDropdownButton'),
        label: document.getElementById('qualityDropdownLabel'),
        options: document.getElementById('qualityDropdownOptions')
    };
    const subtitleDropdown = {
        root: document.getElementById('subtitleDropdown'),
        button: document.getElementById('subtitleDropdownButton'),
        label: document.getElementById('subtitleDropdownLabel'),
        options: document.getElementById('subtitleDropdownOptions')
    };
    const controls = document.getElementById('playerControls');
    const toggleButton = document.getElementById('playerToggle');
    const muteButton = document.getElementById('playerMute');
    const fullscreenButton = document.getElementById('playerFullscreen');
    const stageFullscreenButton = document.getElementById('stageFullscreen');
    const seek = document.getElementById('playerSeek');
    const currentTimeLabel = document.getElementById('playerCurrentTime');
    const durationLabel = document.getElementById('playerDuration');
    const volume = document.getElementById('playerVolume');
    let hls = null;
    let dash = null;
    let shakaPlayer = null;
    let activeSource = null;
    let lastSavedSecond = -1;
    let seeking = false;
    let appFullscreen = false;
    let controlsIdleTimer = null;

    const icons = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM15 5h3v14h-3z"/></svg>',
        volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM17 9a5 5 0 0 1 0 6m2.5-8.5a8.5 8.5 0 0 1 0 11"/></svg>',
        muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM17 9l5 6m0-6-5 6"/></svg>',
        fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>',
        exitFullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5"/></svg>'
    };
    function setPlayButton(playing) {
        toggleButton.innerHTML = playing ? icons.pause : icons.play;

        toggleButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    function setMuteButton(muted) {
        muteButton.innerHTML = muted ? icons.muted : icons.volume;

        muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }
    function setFullscreenState(enabled) {
        appFullscreen = Boolean(enabled);
        playerRoot.classList.toggle('is-app-fullscreen', appFullscreen);
        fullscreenButton.innerHTML = appFullscreen ? icons.exitFullscreen : icons.fullscreen;

        fullscreenButton.setAttribute('aria-label', appFullscreen ? 'Exit player fullscreen' : 'Enter player fullscreen');
        stageFullscreenButton.innerHTML = appFullscreen ? icons.exitFullscreen : icons.fullscreen;

        stageFullscreenButton.setAttribute('aria-label', appFullscreen ? 'Exit player fullscreen' : 'Enter player fullscreen');
    }
    function toggleFullscreen() { bridge?.fullscreen(!appFullscreen); }
    bridge?.onFullscreenState(setFullscreenState);

    function setMessage(text) { message.textContent = text || ''; }
    function closePlayerDropdowns() {
        [qualityDropdown, subtitleDropdown].forEach(dropdown => {
            dropdown.root.classList.remove('open');
            dropdown.button.setAttribute('aria-expanded', 'false');
        });
    }
    function containDropdownWheel(options, event) {
        event.preventDefault();
        event.stopPropagation();
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? options.clientHeight : 1;
        options.scrollTop += event.deltaY * multiplier;
    }
    function syncCustomDropdown(select, dropdown) {
        const selected = select.selectedOptions[0] || select.options[0];
        dropdown.label.textContent = selected?.textContent || '';
        dropdown.root.dataset.value = select.value;
        dropdown.button.disabled = select.disabled;
        dropdown.options.replaceChildren();
        Array.from(select.options).forEach(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'gamelist-sort-option';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(option.value === select.value));
            item.classList.toggle('active', option.value === select.value);
            item.textContent = option.textContent;
            item.addEventListener('click', () => {
                if (select.disabled) return;
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closePlayerDropdowns();
                dropdown.button.focus();
            });
            dropdown.options.appendChild(item);
        });
    }
    function setupCustomDropdown(select, dropdown) {
        dropdown.options.addEventListener('wheel', event => containDropdownWheel(dropdown.options, event), { passive: false });
        dropdown.button.addEventListener('click', () => {
            if (dropdown.button.disabled) return;
            const shouldOpen = !dropdown.root.classList.contains('open');
            closePlayerDropdowns();
            if (!shouldOpen) return;
            dropdown.root.classList.add('open');
            dropdown.button.setAttribute('aria-expanded', 'true');
        });
        dropdown.root.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePlayerDropdowns();
                dropdown.button.focus();
                return;
            }
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            if (!dropdown.root.classList.contains('open')) {
                closePlayerDropdowns();
                dropdown.root.classList.add('open');
                dropdown.button.setAttribute('aria-expanded', 'true');
            }
            const items = Array.from(dropdown.options.querySelectorAll('.gamelist-sort-option'));
            if (!items.length) return;
            event.preventDefault();
            const current = items.indexOf(document.activeElement);
            const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next].focus();
        });
        syncCustomDropdown(select, dropdown);
    }
    function revealControls() {
        clearTimeout(controlsIdleTimer);
        controlsIdleTimer = null;
        playerRoot.classList.remove('controls-hidden');
        repositionSubtitles();
    }
    function scheduleControlsHide() {
        clearTimeout(controlsIdleTimer);
        controlsIdleTimer = null;
        if (!activeSource || activeSource.embed || video.paused || video.ended) {
            revealControls();
            return;
        }
        controlsIdleTimer = setTimeout(() => {
            if (playerRoot.querySelector('.player-select.open')) {
                scheduleControlsHide();
                return;
            }
            playerRoot.classList.add('controls-hidden');
            repositionSubtitles();
        }, 2600);
    }
    function registerPlayerActivity() {
        revealControls();
        scheduleControlsHide();
    }
    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const total = Math.floor(seconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
    }
    function updateTime() {
        const duration = Number(video.duration);
        const current = Number(video.currentTime) || 0;
        currentTimeLabel.textContent = formatTime(current);
        durationLabel.textContent = Number.isFinite(duration) ? formatTime(duration) : 'LIVE';
        seek.disabled = !Number.isFinite(duration) || duration <= 0;
        if (!seeking && Number.isFinite(duration) && duration > 0) seek.value = String(Math.round(current / duration * 1000));
    }
    function refreshSubtitleState() {
        subtitleSelect.disabled = subtitleSelect.options.length <= 1;
        syncCustomDropdown(subtitleSelect, subtitleDropdown);
    }
    function resetQualityOptions() {
        qualitySelect.innerHTML = '<option value="auto">Auto quality</option>';
        qualitySelect.value = 'auto';
        qualitySelect.disabled = true;
        qualityLabel.textContent = 'Auto quality';
        syncCustomDropdown(qualitySelect, qualityDropdown);
    }
    function setSingleQuality(label) {
        const description = String(label || 'Single quality').trim() || 'Single quality';
        qualitySelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = 'single';
        option.textContent = description;
        qualitySelect.appendChild(option);
        qualitySelect.disabled = true;
        qualityLabel.textContent = description;
        syncCustomDropdown(qualitySelect, qualityDropdown);
    }
    function cleanPlayer() {
        revealControls();
        closePlayerDropdowns();
        if (hls) { try { hls.destroy(); } catch (_) {} hls = null; }
        if (dash) { try { dash.reset(); } catch (_) {} dash = null; }
        if (shakaPlayer) { shakaPlayer.destroy().catch(() => {}); shakaPlayer = null; }
        while (video.firstChild) video.removeChild(video.firstChild);
        video.pause();
        video.removeAttribute('src');
        video.load();
        frame.removeAttribute('src');
        stage.classList.remove('has-embed');
        controls.hidden = false;
        subtitleSelect.innerHTML = '<option value="off">Subtitles off</option>';
        refreshSubtitleState();
        resetQualityOptions();
        seek.value = '0';
        currentTimeLabel.textContent = '0:00';
        durationLabel.textContent = '0:00';
        setPlayButton(false);
        setMuteButton(video.muted || video.volume === 0);
        setMessage('');
    }
    function addJsonSubtitles(subtitles) {
        (Array.isArray(subtitles) ? subtitles : []).forEach((subtitle, index) => {
            if (!subtitle?.url) return;
            const track = document.createElement('track');
            track.dataset.watchZoneSubtitle = 'true';
            track.kind = 'subtitles';
            track.label = String(subtitle.label || `Subtitle ${index + 1}`);
            track.srclang = String(subtitle.language || 'und').slice(0, 8);
            track.src = String(subtitle.url);
            track.addEventListener('load', () => {
                positionSubtitleCues(track.track);
                selectSubtitle(subtitleSelect.value);
            });
            if (/english|^en\b/i.test(track.label) || /^en\b/i.test(track.srclang)) track.default = true;
            video.appendChild(track);
        });
        Array.from(video.querySelectorAll('track[data-watch-zone-subtitle]')).forEach((track, index) => {
            const option = document.createElement('option');
            option.value = `track:${index}`;
            option.textContent = track.label || `Subtitle ${index + 1}`;
            subtitleSelect.appendChild(option);
        });
        refreshSubtitleState();
    }
    function positionSubtitleCues(track) {
        repositionSubtitles();
    }
    function repositionSubtitles() {
        const controlsVisible = !controls.hidden && !playerRoot.classList.contains('controls-hidden');
        subtitleOverlay.style.setProperty('--caption-bottom', `${controlsVisible ? controls.offsetHeight + 20 : 24}px`);
        const lines = [];
        for (const track of Array.from(video.textTracks)) {
            if (!['subtitles', 'captions'].includes(track.kind)) continue;
            if (track.mode !== 'showing' && !(track.mode === 'hidden' && subtitleSelect.value !== 'off')) continue;
            for (const cue of Array.from(track.activeCues || [])) {
                const text = (cue.getCueAsHTML?.().textContent || cue.text || '').replace(/\n\s*\n/g, '\n').trim();
                if (text && !lines.includes(text)) lines.push(text);
            }
        }
        const text = lines.join('\n');
        if (subtitleOverlay.textContent === text) return;
        subtitleOverlay.replaceChildren();
        if (text) {
            const span = document.createElement('span');
            span.textContent = text;
            subtitleOverlay.appendChild(span);
        }
    }
    if (window.ResizeObserver) {
        const subtitleLayoutObserver = new ResizeObserver(repositionSubtitles);
        subtitleLayoutObserver.observe(stage);
        subtitleLayoutObserver.observe(controls);
    }
    window.addEventListener('resize', repositionSubtitles);
    video.textTracks.addEventListener('addtrack', event => {
        event.track.addEventListener('cuechange', () => positionSubtitleCues(event.track));
    });
    video.textTracks.addEventListener('change', repositionSubtitles);
    video.addEventListener('timeupdate', repositionSubtitles);
    video.addEventListener('emptied', () => subtitleOverlay.replaceChildren());
    function selectSubtitle(value) {
        if (shakaPlayer) {
            const track = shakaPlayer.getTextTracks().find(item => `shaka:${item.id}` === value);
            shakaPlayer.setTextTrackVisibility(Boolean(track));
            if (track) shakaPlayer.selectTextTrack(track);
        }
        if (hls) {
            const hlsSelected = value.startsWith('hls:');
            hls.subtitleTrack = hlsSelected ? Number(value.slice(4)) : -1;
            hls.subtitleDisplay = hlsSelected;
        }
        // Only toggle sidecar <track> elements here. HLS.js owns its generated
        // TextTracks and disabling every video.textTracks entry can hide its captions.
        Array.from(video.querySelectorAll('track[data-watch-zone-subtitle]')).forEach((element, index) => {
            if (!element.track) return;
            element.track.mode = value === `track:${index}` ? 'showing' : 'disabled';
            if (element.track.mode === 'showing') positionSubtitleCues(element.track);
        });
        repositionSubtitles();
    }
    function chooseDefaultSubtitle() {
        const english = Array.from(subtitleSelect.options).find(option => /english|^en\b/i.test(option.textContent));
        subtitleSelect.value = english?.value || 'off';
        selectSubtitle(subtitleSelect.value);
        syncCustomDropdown(subtitleSelect, subtitleDropdown);
    }
    function addHlsSubtitleOptions() {
        if (!hls) return;
        Array.from(subtitleSelect.querySelectorAll('option[value^="hls:"]')).forEach(option => option.remove());
        (hls.subtitleTracks || []).forEach((track, index) => {
            const option = document.createElement('option');
            option.value = `hls:${index}`;
            option.textContent = track.name || track.lang || `Stream subtitle ${index + 1}`;
            subtitleSelect.appendChild(option);
        });
        refreshSubtitleState();
        if (subtitleSelect.value === 'off') chooseDefaultSubtitle();
    }
    function addHlsQualityOptions() {
        if (!hls) return;
        const previous = qualitySelect.value;
        qualitySelect.innerHTML = '<option value="auto">Auto quality</option>';
        const levels = (hls.levels || []).map((level, index) => ({ level, index })).sort((a, b) => {
            const heightDiff = (Number(a.level.height) || 0) - (Number(b.level.height) || 0);
            return heightDiff || (Number(a.level.bitrate) || 0) - (Number(b.level.bitrate) || 0);
        });
        levels.forEach(({ level, index }) => {
            const option = document.createElement('option');
            option.value = String(index);
            const height = Number(level.height) || 0;
            const bitrate = Number(level.bitrate) || 0;
            option.textContent = level.name || (height ? `${height}p` : `${Math.round(bitrate / 1000)} kbps`);
            qualitySelect.appendChild(option);
        });
        qualitySelect.disabled = levels.length === 0;
        if (previous !== 'auto' && levels.some(({ index }) => String(index) === previous)) qualitySelect.value = previous;
        syncCustomDropdown(qualitySelect, qualityDropdown);
    }
    function addDashQualityOptions() {
        if (!dash) return;
        const rates = dash.getBitrateInfoListFor('video') || [];
        qualitySelect.innerHTML = '<option value="auto">Auto quality</option>';
        rates.forEach((rate, index) => {
            const option = document.createElement('option');
            const qualityIndex = Number.isFinite(Number(rate.qualityIndex)) ? Number(rate.qualityIndex) : index;
            option.value = String(qualityIndex);
            option.textContent = rate.height ? `${rate.height}p` : `${Math.round((rate.bitrate || 0) / 1000)} kbps`;
            qualitySelect.appendChild(option);
        });
        qualitySelect.disabled = rates.length === 0;
        qualityLabel.textContent = rates.length ? 'Auto quality' : 'DASH';
        syncCustomDropdown(qualitySelect, qualityDropdown);
    }
    function xhrSetupFactory(headers) {
        return xhr => {
            xhr.withCredentials = true;
            for (const [name, value] of Object.entries(headers || {})) {
                try { xhr.setRequestHeader(name, value); } catch (_) {}
            }
        };
    }
    function startHls(source) {
        if (window.Hls?.isSupported()) {
            hls = new window.Hls({
                enableWorker: true,
                lowLatencyMode: false,
                xhrSetup: xhrSetupFactory(source.headers),
                fetchSetup: (context, initParams) => {
                    const headers = new Headers(initParams?.headers || {});
                    for (const [name, value] of Object.entries(source.headers || {})) {
                        try { headers.set(name, value); } catch (_) {}
                    }
                    return new Request(context.url, { ...initParams, headers });
                }
            });
            hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(source.url));
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                addHlsQualityOptions();
                addHlsSubtitleOptions();
                qualityLabel.textContent = hls.levels.length ? `${Math.max(...hls.levels.map(level => Number(level.height) || 0))}p available` : 'HLS';
                video.play().catch(() => setMessage('Source ready. Press Play to start.'));
            });
            hls.on(window.Hls.Events.LEVELS_UPDATED, addHlsQualityOptions);
            hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, addHlsSubtitleOptions);
            hls.on(window.Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                const height = Number(hls.levels?.[data.level]?.height) || 0;
                qualityLabel.textContent = qualitySelect.value === 'auto' ? `Auto · ${height ? `${height}p` : 'HLS'}` : (height ? `${height}p` : 'HLS');
            });
            hls.on(window.Hls.Events.ERROR, (_event, data) => {
                if (data?.fatal) setMessage(data.type === window.Hls.ErrorTypes.NETWORK_ERROR ? 'Stream network error. Retry or choose another source.' : 'This stream could not be decoded.');
            });
            hls.attachMedia(video);
            setMessage('Loading stream…');
            return;
        }
        video.src = source.url;
        setSingleQuality('HLS · Auto quality');
        video.play().catch(() => setMessage('Source ready. Press Play to start.'));
    }
    function addShakaOptions() {
        if (!shakaPlayer) return;
        const tracks = shakaPlayer.getVariantTracks().filter(track => track.videoId != null);
        const heights = new Set();
        qualitySelect.innerHTML = '<option value="auto">Auto quality</option>';
        tracks.sort((left, right) => left.height - right.height).forEach(track => {
            if (heights.has(track.height)) return;
            heights.add(track.height);
            const option = new Option(track.height ? `${track.height}p` : `${Math.round(track.bandwidth / 1000)} kbps`, String(track.id));
            qualitySelect.add(option);
        });
        qualitySelect.disabled = !tracks.length;
        syncCustomDropdown(qualitySelect, qualityDropdown);
        Array.from(subtitleSelect.querySelectorAll('option[value^="shaka:"]')).forEach(option => option.remove());
        shakaPlayer.getTextTracks().forEach(track => subtitleSelect.add(new Option(track.label || track.language || 'Subtitle', `shaka:${track.id}`)));
        refreshSubtitleState();
    }
    async function startShaka(source) {
        if (!window.shaka?.Player) { setMessage('The IPTV player library could not load. Refresh to retry.'); return; }
        window.shaka.polyfill.installAll();
        if (!window.shaka.Player.isBrowserSupported()) { setMessage('DASH playback is unsupported on this device.'); return; }
        const player = new window.shaka.Player();
        shakaPlayer = player;
        try {
            await player.attach(video);
            if (shakaPlayer !== player) return;
            const config = { streaming: { bufferingGoal: 10, rebufferingGoal: 2, bufferBehind: 10, lowLatencyMode: true } };
            if (source.drm?.keyId && source.drm?.key) config.drm = { clearKeys: { [source.drm.keyId]: source.drm.key } };
            player.configure(config);
            player.getNetworkingEngine().registerRequestFilter((_type, request) => {
                request.allowCrossSiteCredentials = false;
                const scope = source.playback?.queryScope;
                request.uris = request.uris.map(uri => {
                    const target = new URL(uri, source.url);
                    if (scope && target.origin === scope.origin && target.pathname.startsWith(scope.path)) {
                        for (const [name, value] of Object.entries(source.playback.queryParams || {})) if (!target.searchParams.has(name)) target.searchParams.set(name, value);
                    }
                    return target.toString();
                });
            });
            player.addEventListener('error', event => {
                if (shakaPlayer !== player) return;
                const code = Number(event.detail?.code) || 0;
                setMessage(`This IPTV source could not play (DASH ${code}). Refresh or choose another source.`);
            });
            setMessage('Loading stream…');
            await player.load(source.url);
            if (shakaPlayer !== player) return;
            addShakaOptions();
            qualityLabel.textContent = 'DASH · Auto';
            await video.play().catch(() => setMessage('Source ready. Press Play to start.'));
        } catch (error) {
            if (shakaPlayer === player) setMessage(`This IPTV source could not play (DASH ${Number(error.code) || 0}). Refresh or choose another source.`);
        }
    }
    function startDash(source) {
        if (!window.dashjs?.MediaPlayer) {
            video.src = source.url;
            qualityLabel.textContent = 'DASH';
            setMessage('DASH library unavailable. Trying native playback…');
            return;
        }
        dash = window.dashjs.MediaPlayer().create();
        if (source.drm?.keyId && source.drm?.key) {
            dash.setProtectionData({
                'org.w3.clearkey': { clearkeys: { [source.drm.keyId]: source.drm.key } }
            });
        }
        dash.extend('RequestModifier', () => ({
            modifyRequestHeader(xhr) {
                for (const [name, value] of Object.entries(source.headers || {})) {
                    try { xhr.setRequestHeader(name, value); } catch (_) {}
                }
                return xhr;
            },
            modifyRequestURL(url) { return url; }
        }), true);
        dash.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, addDashQualityOptions);
        dash.on(window.dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, addDashQualityOptions);
        dash.on(window.dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, event => {
            if (event?.mediaType !== 'video') return;
            const rate = (dash.getBitrateInfoListFor('video') || []).find((item, index) => Number(item.qualityIndex ?? index) === Number(event.newQuality));
            qualityLabel.textContent = qualitySelect.value === 'auto' ? `Auto · ${rate?.height ? `${rate.height}p` : 'DASH'}` : (rate?.height ? `${rate.height}p` : 'DASH');
        });
        dash.on(window.dashjs.MediaPlayer.events.ERROR, () => setMessage('This DASH stream could not be loaded.'));
        dash.initialize(video, source.url, true);
        qualityLabel.textContent = 'DASH · Auto';
        setMessage('Loading stream…');
    }
    function startSource(source) {
        cleanPlayer();
        updateEpisodeNavigation(source.episodeNavigation);
        activeSource = source;
        title.textContent = source.title || 'Watch Zone';
        if (source.embed) {
            stage.classList.add('has-embed');
            controls.hidden = true;
            subtitleSelect.disabled = true;
            qualitySelect.disabled = true;
            refreshSubtitleState();
            syncCustomDropdown(qualitySelect, qualityDropdown);
            qualityLabel.textContent = 'Embed · use source captions/quality';

            frame.src = source.url;
            setMessage('');
            return;
        }

        addJsonSubtitles(source.subtitles);
        const pathname = (() => { try { return new URL(source.url).pathname.toLowerCase(); } catch (_) { return String(source.url).toLowerCase(); } })();
        const type = String(source.type || '').toLowerCase();
        if (source.playback?.engine === 'shaka') startShaka(source);
        else if (type.includes('dash') || /\.mpd$/i.test(pathname)) startDash(source);
        else if (type.includes('hls') || /\.m3u8$/i.test(pathname)) startHls(source);
        else {
            video.src = source.url;
            setSingleQuality(source.quality || 'Single quality');
            video.play().catch(() => setMessage('Source ready. Press Play to start.'));
        }
        if (source.quality) qualityLabel.textContent = source.quality;
    }

    qualitySelect.addEventListener('change', () => {
        syncCustomDropdown(qualitySelect, qualityDropdown);
        if (hls) {
            const index = qualitySelect.value === 'auto' ? -1 : Number(qualitySelect.value);
            hls.nextLevel = index;
            qualityLabel.textContent = index < 0 ? 'Auto quality' : (hls.levels[index]?.height ? `${hls.levels[index].height}p selected` : 'Manual quality');
        } else if (shakaPlayer) {
            const automatic = qualitySelect.value === 'auto';
            shakaPlayer.configure({ abr: { enabled: automatic } });
            const track = shakaPlayer.getVariantTracks().find(item => String(item.id) === qualitySelect.value);
            if (!automatic && track) shakaPlayer.selectVariantTrack(track, true);
            qualityLabel.textContent = automatic ? 'DASH · Auto' : qualitySelect.selectedOptions[0]?.textContent || 'Manual quality';
        } else if (dash) {
            const automatic = qualitySelect.value === 'auto';
            dash.setAutoSwitchQualityFor('video', automatic);
            if (!automatic) dash.setQualityFor('video', Number(qualitySelect.value));
            qualityLabel.textContent = automatic ? 'Auto quality' : (qualitySelect.selectedOptions[0]?.textContent || 'Manual quality');
        }
    });
    subtitleSelect.addEventListener('change', () => {
        syncCustomDropdown(subtitleSelect, subtitleDropdown);
        selectSubtitle(subtitleSelect.value);
    });
    setupCustomDropdown(qualitySelect, qualityDropdown);
    setupCustomDropdown(subtitleSelect, subtitleDropdown);
    displaySelect.addEventListener('change', () => {
        video.style.objectFit = { fit: 'contain', fill: 'cover', stretch: 'fill' }[displaySelect.value] || 'contain';
        const labels = { fit: 'Fit', fill: 'Fill', stretch: 'Stretch' };
        const modes = ['fit', 'fill', 'stretch'];
        const next = modes[(modes.indexOf(displaySelect.value) + 1) % modes.length];
        displayLabel.textContent = labels[displaySelect.value];
        displayButton.querySelector('svg').innerHTML = {
            fit: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10v6H7z"/>',
            fill: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 8H6v2m10-2h2v2M6 14v2h2m10-2v2h-2"/>',
            stretch: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 12h12m-9-3-3 3 3 3m6-6 3 3-3 3"/>'
        }[displaySelect.value];

        displayButton.setAttribute('aria-label', `Video sizing: ${displayLabel.textContent}. Click to switch to ${labels[next]}`);
        repositionSubtitles();
    });
    displayButton.addEventListener('click', () => {
        closePlayerDropdowns();
        const modes = ['fit', 'fill', 'stretch'];
        displaySelect.value = modes[(modes.indexOf(displaySelect.value) + 1) % modes.length];
        displaySelect.dispatchEvent(new Event('change'));
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.player-select')) closePlayerDropdowns();
    });
    toggleButton.addEventListener('click', () => {
        if (video.paused) video.play().catch(() => setMessage('Press Play to start playback.'));
        else video.pause();
    });
    document.getElementById('playerBackTen').addEventListener('click', () => {
        if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.currentTime - 10);
    });
    document.getElementById('playerForwardTen').addEventListener('click', () => {
        if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
    });
    muteButton.addEventListener('click', () => { video.muted = !video.muted; });
    volume.addEventListener('input', () => { video.volume = Number(volume.value); if (video.volume > 0) video.muted = false; });
    fullscreenButton.addEventListener('click', toggleFullscreen);
    stageFullscreenButton.addEventListener('click', toggleFullscreen);
    seek.addEventListener('input', () => {
        seeking = true;
        if (Number.isFinite(video.duration) && video.duration > 0) {
            const position = Number(seek.value) / 1000 * video.duration;
            currentTimeLabel.textContent = formatTime(position);
        }
    });
    seek.addEventListener('change', () => {
        if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Number(seek.value) / 1000 * video.duration;
        seeking = false;
        updateTime();
    });
    video.addEventListener('play', () => { setPlayButton(true); scheduleControlsHide(); });
    video.addEventListener('pause', () => { setPlayButton(false); revealControls(); });
    video.addEventListener('volumechange', () => {
        setMuteButton(video.muted || video.volume === 0);
        if (Number(volume.value) !== video.volume) volume.value = String(video.volume);
    });
    video.addEventListener('loadedmetadata', () => {
        if (activeSource?.startPosition > 0 && Number.isFinite(video.duration) && activeSource.startPosition < video.duration) video.currentTime = activeSource.startPosition;
        chooseDefaultSubtitle();
        updateTime();
        setMessage('');
    });
    video.addEventListener('durationchange', updateTime);
    video.addEventListener('timeupdate', () => {
        updateTime();
        const second = Math.floor(video.currentTime || 0);
        if (second > 0 && second % 5 === 0 && second !== lastSavedSecond) {
            lastSavedSecond = second;
            bridge?.progress({ position: video.currentTime, duration: video.duration || 0 });
        }
    });
    video.addEventListener('error', () => setMessage('The source could not be played in the in-app player.'));
    video.addEventListener('playing', () => { setMessage(''); scheduleControlsHide(); });
    [stage, controls, document.querySelector('.player-top')].forEach(element => {
        element.addEventListener('pointermove', registerPlayerActivity, { passive: true });
        element.addEventListener('pointerdown', registerPlayerActivity, { passive: true });
        element.addEventListener('touchstart', registerPlayerActivity, { passive: true });
    });
    stage.addEventListener('wheel', event => {
        if (event.defaultPrevented || event.target.closest('.gamelist-sort-options')) return;
        bridge?.scroll(event.deltaY);
    }, { passive: true });
    document.addEventListener('keydown', event => {
        registerPlayerActivity();
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target?.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName)) return;
        const key = event.key.toLowerCase();
        if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
        else if (key === 'escape' && appFullscreen) { event.preventDefault(); toggleFullscreen(); }
        else if ((key === ' ' || key === 'k') && target?.tagName !== 'BUTTON') {
            event.preventDefault();
            if (video.paused) video.play().catch(() => setMessage('Press Play to start playback.'));
            else video.pause();
        } else if (key === 'arrowleft' || key === 'j') {
            event.preventDefault();
            if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.currentTime - 10);
        } else if (key === 'arrowright' || key === 'l') {
            event.preventDefault();
            if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
        } else if (key === 'm') video.muted = !video.muted;
    });
    bridge?.onSource(startSource);
})();
