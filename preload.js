// your-app-name/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, ...data) => {
        const validSendChannels = [
            'process-appid',
            'process-library-item-update', // New channel for library item updates
            'submit-auth-code',
            'handle-dropped-file-data',
            'delete-appid-files',
            'set-auto-save-state',
            'open-external-url',
            'open-steam-config-folder',
            'set-dlc-mode-state',
            'user-logout',
            'add-all-dlcs-for-game',
            'remove-all-dlcs-for-game',
            'wipe-steamtools-data',
            'fix-steamtools',
            'set-unlock-game-state',
            'close-app', // ADDED FOR CLOSE BUTTON
            'minimize-app',
            'maximize-app'
        ];
        if (validSendChannels.includes(channel)) {
            ipcRenderer.send(channel, ...data);
        } else {
            console.warn(`[Preload] Attempted to send on invalid channel: ${channel}`);
        }
    },
    invoke: (channel, ...data) => {
        const validInvokeChannels = [
            'get-app-version',
            'check-steam-status',
            'start-steam',
            'restart-steam',
            'stop-steam', // Added new channel
            'install-steam-game',
            'uninstall-steam-game',
            'launch-steam-game',
            'select-download-location',
            'get-current-download-location',
            'get-auto-save-state',
            'get-dlc-mode-state',
            'get-library-games',
            'get-installed-games',
            'get-steam-installed-games',
            'steamless-get-installed-games',
            'steamless-set-dll-state',
            'steamless-launch-game',
            'get-online-games',
            'get-game-extended-info',
            'get-game-image',
            'find-appid-by-title',
            'scrape-steam250-chart',
            'fetch-more-gamelist',
            'fetch-gamelist-category',
            'request-device-change', // Added for device change
            'get-unlock-game-state', // ADDED
            'online-fix-open-folder',
            'online-fix-set-path',
            'online-fix-apply',
            'online-fix-remove',
            'disable-appid-manifest',
            'apply-old-steam',
            'remove-old-steam',
            'apply-steam-fix',
            // --- merged modules (GameZoneQA Ultimate) ---
            'app-open-external',
            'youtube-music-view',
            'youtube-music-control',
            'app-fetch-text',
            'app-fetch-endpoint',
            'app-contact-data', 'app-distributors',
            'app-get-config',
            'help-download-pdf',
            'home-get-announcements',
            'help-get-items',
            'help-probe-url',
            'product-get-items',
            'product-download-file',
            'get-steam-cfg-state',
            'set-steam-cfg-state',
            'drm-get-wub-status', 'drm-set-wub-state',
            'drm-get-disable-update-games', 'drm-set-disable-update',
            'drm-process-ea-reya', 'drm-process-ubisoft-reya', 'drm-process-reya-file',
            'drm-reset-game-path', 'drm-get-location', 'drm-open-game-folder',
            'drm-select-location', 'drm-start-bypass', 'drm-launch-game-process', 'drm-save-and-open-token',
            'gl-fetch-games', 'gl-fetch-online-fixes', 'gl-fetch-drm-games', 'gl-fetch-switch-games',
            'gl-select-directory', 'gl-patch-game', 'gl-auto-patch-game',
            'sw-fetch-software', 'sw-show-save-dialog', 'sw-download-file',
            'zp-fetch-games', 'zp-select-download-folder', 'zp-start-download', 'zp-pause-download',
            'zp-resume-download', 'zp-stop-download', 'zp-create-desktop-shortcut', 'zp-add-to-steam-offline',
            'zp-launch-game', 'zp-open-install-folder', 'zp-delete-install',
            'retro-play-fetch', 'retro-play-sign-in', 'retro-play-sign-out', 'retro-play-auth-status', 'retro-play-open-library',
            'retro-play-start', 'retro-play-pause', 'retro-play-resume', 'retro-play-stop',
            'retro-play-launch', 'retro-play-open-game-folder', 'retro-play-delete',
            'watch-zone-home', 'watch-zone-view-all', 'watch-zone-search', 'watch-zone-details', 'watch-zone-episodes', 'watch-zone-anime-episodes', 'watch-zone-cartoon-episodes',
            'watch-zone-state', 'watch-zone-save-progress', 'watch-zone-remove-progress', 'watch-zone-clear-progress', 'watch-zone-iptv-channels', 'watch-zone-play', 'watch-zone-player-metadata',
            'watch-zone-player-layout', 'watch-zone-player-close', 'watch-zone-player-position'
        ];
        if (validInvokeChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...data);
        }
        console.warn(`[Preload] Attempted to invoke on invalid channel: ${channel}`);
        return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
    },
    on: (channel, func) => {
        const validReceiveChannels = [
            'status-update',
            'auth-result',
            'version-mismatch',
            'steam-control-ready',
            'current-save-path',
            'auto-save-state-update',
            'dlc-mode-state-update',
            'dlc-operation-status',
            'dlc-toggle-result',
            'library-item-update-complete',
            'gamelist-item-process-complete',
            'show-themed-message',
            'unlock-game-state-update', 'youtube-music-fullscreen-state', 'youtube-music-inline-controls-state', // ADDED
            // --- merged modules (GameZoneQA Ultimate) ---
            'drm-status-update', 'drm-current-path', 'drm-ticket-found', 'watch-zone-scroll', 'watch-zone-episode-step',
            'gl-patch-status', 'gl-download-progress',
            'sw-download-status', 'sw-download-progress',
            'product-download-status', 'product-download-progress',
            'zp-download-status', 'zp-download-progress',
            'retro-play-download-status', 'retro-play-download-progress', 'retro-play-archive-status'
        ];
        if (validReceiveChannels.includes(channel)) {
            const listener = (event, ...args) => {
                try {
                    func(...args);
                } catch (error) {
                    console.error(`[Preload] Error in listener for channel ${channel}.`); // Generic error
                }
            };
            ipcRenderer.on(channel, listener);
        } else {
            console.warn(`[Preload] Attempted to listen on invalid channel: ${channel}`);
        }
    },
    removeAllListeners: (channel) => {
        const validReceiveChannels = [
            'status-update',
            'auth-result',
            'version-mismatch',
            'steam-control-ready',
            'current-save-path',
            'auto-save-state-update',
            'dlc-mode-state-update',
            'dlc-operation-status',
            'dlc-toggle-result',
            'library-item-update-complete',
            'gamelist-item-process-complete',
            'show-themed-message',
            'unlock-game-state-update', 'youtube-music-fullscreen-state', 'youtube-music-inline-controls-state',
            // --- merged modules (GameZoneQA Ultimate) ---
            'drm-status-update', 'drm-current-path', 'drm-ticket-found',
            'gl-patch-status', 'gl-download-progress',
            'sw-download-status', 'sw-download-progress',
            'product-download-status', 'product-download-progress',
            'zp-download-status', 'zp-download-progress'
        ];
        if (validReceiveChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        } else {
            console.warn(`[Preload] Attempted to remove listeners from invalid channel: ${channel}`);
        }
    }
});
