const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
for (const output of [process.stdout, process.stderr]) output.on('error', () => app.exit(1));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let window;
  try {
    const root = path.join(__dirname, '../renderer');
    const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const start = source.indexOf('<div class="watchzone-toolbar">');
    const toolbar = source.slice(start, source.indexOf('<div id="watchZoneStatus"', start));
    const css = fs.readFileSync(path.join(root, 'watchzone.css'), 'utf8');
    window = new BrowserWindow({ show: false, width: 1440, height: 500 });
    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<style>
      *{box-sizing:border-box}body{margin:0;padding:20px;font-family:Arial}
      :root{--border-color:#333;--input-bg:#191919;--secondary-bg:#191919;--text-secondary:#aaa;--accent-color:#e11d2a;--font-family:Arial}
      ${css}</style><div id="watchZoneView">${toolbar}</div>`));
    for (const width of [1440,960,520]) {
      window.setContentSize(width, 500);
      await new Promise(resolve => setTimeout(resolve, 100));
      for (const tagsVisible of [false,true]) {
        const result = await window.webContents.executeJavaScript(`(() => {
          document.getElementById('watchZoneTagWrap').hidden=${!tagsVisible};
          const search=document.getElementById('watchZoneSearchForm').getBoundingClientRect();
          const refresh=document.getElementById('watchZoneRefresh').getBoundingClientRect();
          const tabs=document.querySelector('.watchzone-mode-tabs').getBoundingClientRect();
          const input=document.querySelector('.watchzone-search-input');
          const submit=document.querySelector('#watchZoneSearchForm button');
          if(input.contains(submit))throw Error('Search button is inside input box');
          if(submit.getBoundingClientRect().left<input.getBoundingClientRect().right)throw Error('Search button overlaps input box');
          return {width:innerWidth,refreshWidth:refresh.width,refreshHeight:refresh.height,searchHeight:search.height,refreshRight:refresh.right,searchRight:search.right,refreshLeft:refresh.left,searchY:search.top,refreshY:refresh.top,tabsLeft:tabs.left};
        })()`);
        console.log(JSON.stringify({tagsVisible,...result}));
        assert.equal(result.refreshWidth,36);
        assert(Math.abs(result.refreshRight-(width-20))<2,'Refresh was not at right edge');
        assert(result.searchRight<=result.refreshLeft,'Search overlaps Refresh');
        assert(Math.abs(result.searchY-result.refreshY)<=4,'Search and Refresh are not on same row');
        assert.equal(result.tabsLeft,20);
      }
    }
    app.exit(0);
  } catch(error) { console.error(error.message); app.exit(1); }
  finally { if(window && !window.isDestroyed()) window.destroy(); }
});
