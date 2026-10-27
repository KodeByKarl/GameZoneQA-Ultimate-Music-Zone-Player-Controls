(() => {
  const rootPath = location.pathname.replace(/player\.html$/, '');
  const loading = document.getElementById('loadingState');
  const error = document.getElementById('errorState');
  const controllerExitNotice = document.getElementById('controllerExitNotice');
  const controllerExitMessage = document.getElementById('controllerExitMessage');
  const controllerExitProgress = document.getElementById('controllerExitProgress');
  const exitHoldDuration = 1500;
  let exitHoldStartedAt = null;
  let exitShortcutTriggered = false;
  let didStart = false;

  function closePlayer() {
    if (window.retroPlayer && typeof window.retroPlayer.close === 'function') {
      window.retroPlayer.close();
      return;
    }
    window.close();
  }

  function buttonPressed(button) {
    return typeof button === 'object' ? Boolean(button && button.pressed) : Number(button || 0) >= 0.5;
  }

  function installControllerExitShortcut() {
    const method = typeof navigator.getGamepads === 'function'
      ? 'getGamepads'
      : (typeof navigator.webkitGetGamepads === 'function' ? 'webkitGetGamepads' : '');
    if (!method) return;

    const readGamepads = navigator[method].bind(navigator);
    const updateExitState = (pads) => {
      const holdingChord = pads.some((pad) => pad && buttonPressed(pad.buttons[8]) && buttonPressed(pad.buttons[9]));
      if (!holdingChord) {
        exitHoldStartedAt = null;
        exitShortcutTriggered = false;
        controllerExitNotice.hidden = true;
        controllerExitProgress.style.width = '0%';
        return false;
      }

      const now = performance.now();
      if (exitHoldStartedAt === null) {
        exitHoldStartedAt = now;
        controllerExitNotice.hidden = false;
        controllerExitMessage.textContent = 'Keep holding Start + Select to return to the library';
      }

      const progress = Math.min(1, (now - exitHoldStartedAt) / exitHoldDuration);
      controllerExitProgress.style.width = Math.round(progress * 100) + '%';
      if (progress >= 1 && !exitShortcutTriggered) {
        exitShortcutTriggered = true;
        controllerExitMessage.textContent = 'Returning to the library…';
        window.setTimeout(closePlayer, 120);
      }
      return true;
    };

    const wrappedReadGamepads = () => {
      const pads = Array.from(readGamepads() || []);
      const holdingChord = updateExitState(pads);
      if (!holdingChord) return pads;

      return pads.map((pad) => {
        if (!pad || !buttonPressed(pad.buttons[8]) || !buttonPressed(pad.buttons[9])) return pad;
        const buttons = Array.from(pad.buttons);
        buttons[8] = { pressed: false, touched: false, value: 0 };
        buttons[9] = { pressed: false, touched: false, value: 0 };
        return new Proxy(pad, {
          get(target, property) {
            return property === 'buttons' ? buttons : Reflect.get(target, property, target);
          }
        });
      });
    };

    try {
      Object.defineProperty(navigator, method, { configurable: true, value: wrappedReadGamepads });
    } catch (_) {
      try { navigator[method] = wrappedReadGamepads; } catch (_) {}
    }
  }

  function fail(message) {
    loading.hidden = true;
    document.getElementById('errorMessage').textContent = message;
    error.hidden = false;
  }

  function showFullscreenSystemLabel(systemName) {
    const emulator = document.getElementById('emulator');
    if (!emulator || emulator.querySelector('.retro-fullscreen-system-label')) return;
    const label = document.createElement('div');
    label.className = 'retro-fullscreen-system-label';
    label.textContent = systemName + ' · Retro Play';
    label.setAttribute('aria-hidden', 'true');
    emulator.appendChild(label);
  }

  document.getElementById('exitButton').addEventListener('click', closePlayer);
  document.querySelectorAll('[data-exit]').forEach((button) => button.addEventListener('click', closePlayer));
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyF' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    event.preventDefault();
    event.stopPropagation();
    if (window.retroPlayer && typeof window.retroPlayer.toggleFullscreen === 'function') {
      window.retroPlayer.toggleFullscreen();
    }
  }, true);
  installControllerExitShortcut();
  window.addEventListener('error', (event) => {
    if (!didStart) fail(event.message || 'The emulator runtime failed to load.');
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (!didStart) fail(event.reason?.message || 'The emulator runtime failed to load.');
  });

  async function start() {
    const gameId = new URLSearchParams(location.search).get('id');
    if (!gameId || !/^[a-z0-9-]+$/i.test(gameId)) throw new Error('This game entry is invalid.');
    const response = await fetch(rootPath + 'api/game?id=' + encodeURIComponent(gameId), { cache: 'no-store' });
    if (!response.ok) throw new Error('The installed game could not be opened.');
    const game = await response.json();

    document.title = game.title + ' · Retro Play';
    document.getElementById('loadingTitle').textContent = 'Loading ' + game.title + '…';
    document.getElementById('gameSubtitle').textContent = game.systemName;
    document.getElementById('loadingPlatform').textContent = 'Starting the bundled ' + game.systemName + ' core';

    window.EJS_player = '#emulator';
    window.EJS_core = game.core;
    window.EJS_gameUrl = rootPath + 'api/rom?id=' + encodeURIComponent(gameId);
    window.EJS_gameName = game.title;
    window.EJS_pathtodata = rootPath + 'emulatorjs/data/';
    window.EJS_color = '#e11d2a';
    window.EJS_DEBUG_XX = true;
    window.EJS_startOnLoaded = true;
    window.EJS_threads = true;
    window.EJS_disableDatabases = true;
    window.EJS_language = 'en-US';
    window.EJS_disableAutoLang = false;
    window.EJS_ready = () => {
      didStart = true;
      loading.hidden = true;
    };
    window.EJS_onGameStart = () => {
      didStart = true;
      loading.hidden = true;
      showFullscreenSystemLabel(game.systemName);
    };
    const loader = document.createElement('script');
    loader.src = rootPath + 'emulatorjs/data/loader.js';
    loader.onerror = () => fail('The bundled EmulatorJS files could not be loaded.');
    document.head.appendChild(loader);
  }

  start().catch((error) => fail(error.message || 'Could not prepare this game.'));
})();
