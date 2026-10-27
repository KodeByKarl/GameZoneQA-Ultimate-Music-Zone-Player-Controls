const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
module.exports = (app, kind = 'watch') => {
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const start = source.indexOf('const GAMEZONE_PLAYER_PRELOAD_SOURCES =');
    const end = source.indexOf('const CONTACT_FALLBACK =', start);
    const context = { fs, path, app };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end) + '\nglobalThis.prepare = gameZonePlayerPreload;', context);
    return context.prepare(kind);
};
