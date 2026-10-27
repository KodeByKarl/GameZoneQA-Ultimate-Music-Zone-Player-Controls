const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
for (const output of [process.stdout, process.stderr]) output.on('error', () => app.exit(1));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let server, window;
  try {
    const renderer = path.join(__dirname, '../renderer');
    server = http.createServer((req, res) => {
      const filename = req.url.includes('.js') ? 'watch-zone-player.js' : 'watch-zone-player.html';
      let source = fs.readFileSync(path.join(renderer, filename), 'utf8');
      if (filename.endsWith('.html')) source = source.replace(/<script src="https:[^]*?<\/script>/g, '');
      res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(source);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    window = new BrowserWindow({ show: false, width: 960, height: 600, webPreferences: {
      preload: require('./player-test-preload.cjs')(app), sandbox: true,
      contextIsolation: true, backgroundThrottling: false
    } });
    ipcMain.on('watch-zone-player-fullscreen', (_event, enabled) => {
      window.setContentSize(enabled ? 1920 : 960, enabled ? 1080 : 600);
      window.webContents.send('watch-zone-player-fullscreen-state', Boolean(enabled));
    });
    const episodeSteps = [];
    ipcMain.on('watch-zone-player-episode', (_event, direction) => episodeSteps.push(direction));
    await window.loadURL(`http://127.0.0.1:${server.address().port}/player.html`);
    await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width=1280; canvas.height=720;
      const context=canvas.getContext('2d');
      setInterval(() => { context.fillStyle='#32435c'; context.fillRect(0,0,1280,720); }, 50);
      const video=document.querySelector('video'); video.muted=true; video.srcObject=canvas.captureStream(20);
      const track=video.addTextTrack('subtitles','English','en'); track.mode='showing';
      track.addCue(new VTTCue(0,1000,'I am the definition of serenity.\\nSecond subtitle line is fully visible.'));
      await video.play();
    })()`);
    async function check(label) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await window.webContents.executeJavaScript(`(() => {
        const video=document.querySelector('video'), stage=document.querySelector('.stage');
        const v=video.getBoundingClientRect(), s=stage.getBoundingClientRect();
        const caption=document.getElementById('subtitleOverlay'), c=caption.getBoundingClientRect();
        const controls=document.getElementById('playerControls').getBoundingClientRect();
        return {videoHeight:v.height,stageHeight:s.height,videoBottom:v.bottom,stageBottom:s.bottom,
          captionBottom:c.bottom,captionHeight:c.height,controlsTop:controls.top,
          fontSize:parseFloat(getComputedStyle(caption).fontSize),text:caption.textContent,active:video.textTracks[0].activeCues.length};
      })()`);
      assert(Math.abs(result.videoHeight-result.stageHeight)<2, 'Video overflowed its stage');
      assert(result.videoBottom<=result.stageBottom+1, 'Video bottom was clipped');
      assert(result.captionBottom<=result.controlsTop-8, 'Captions overlap controls');
      assert(result.controlsTop-result.captionBottom<30, 'Captions are too far above controls');
      assert(result.captionHeight<=result.fontSize*1.2*2+7, 'Two subtitle lines are too far apart');
      assert(result.active>0, 'Caption was not active');
      console.log(JSON.stringify({label,...result}));
      const screenshot = await window.webContents.capturePage();
      fs.writeFileSync(path.join(app.getPath('temp'), label.startsWith('F ') ? 'gamezone-caption-fullscreen.png' : 'gamezone-caption-windowed.png'), screenshot.toPNG());
    }
    await check('windowed');
    assert.equal(await window.webContents.executeJavaScript("getComputedStyle(document.querySelector('video')).objectFit"), 'contain');
    for (const [mode, expected] of [['fill','cover'],['stretch','fill'],['fit','contain']]) {
      const sizing = await window.webContents.executeJavaScript(`(() => {
        document.getElementById('displayDropdownButton').click();
        if(document.getElementById('displaySelect').value!==${JSON.stringify(mode)})throw Error('Sizing cycle failed');
        if(document.querySelector('#displayDropdown .gamelist-sort-options'))throw Error('Unexpected sizing dropdown');
        if(document.getElementById('displayDropdown').getBoundingClientRect().width!==34)throw Error('Sizing icon is too wide');
        if(document.querySelector('[title],[alt]'))throw Error('Unexpected tooltip or alt attribute in player');
        if(getComputedStyle(document.getElementById('displayDropdownLabel')).display!=='none')throw Error('Sizing text is visible');
        return getComputedStyle(document.querySelector('video')).objectFit;
      })()`);
      assert.equal(sizing, expected);
    }
    await window.webContents.executeJavaScript("document.getElementById('displaySelect').value='fit';document.getElementById('displaySelect').dispatchEvent(new Event('change'))");
    async function navigation(state, expected) {
      window.webContents.send('watch-zone-player-episode-navigation', state);
      await new Promise(resolve => setTimeout(resolve, 50));
      const actual = await window.webContents.executeJavaScript("(() => {const p=document.getElementById('playerPreviousEpisode'),n=document.getElementById('playerNextEpisode');return [p.hidden,n.hidden,p.disabled,n.disabled]})()");
      assert.deepEqual(actual, expected);
    }
    await navigation({enabled:true,previous:0,next:2}, [false,false,true,false]);
    await window.webContents.executeJavaScript("document.getElementById('playerNextEpisode').click()");
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(episodeSteps,[1]);
    await navigation({enabled:true,previous:1,next:3}, [false,false,false,false]);
    await window.webContents.executeJavaScript("document.getElementById('playerPreviousEpisode').click()");
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(episodeSteps,[1,-1]);
    await navigation({enabled:true,previous:2,next:0}, [false,false,false,true]);
    await navigation({enabled:false}, [true,true,true,true]);
    console.log('PASS: episode icons show only for series; first/last boundaries; clicks send next/previous through player bridge');
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'F'});
    window.webContents.sendInputEvent({type:'keyUp',keyCode:'F'});
    await check('F fullscreen layout');
    assert.equal(await window.webContents.executeJavaScript("getComputedStyle(document.querySelector('video')).objectFit"), 'contain');
    console.log('PASS: Fit default; one-click sizing cycle; compact captions above controls; F preserves sizing');
    app.exit(0);
  } catch (error) { console.error(error.message); app.exit(1); }
  finally { if (server) server.close(); if (window && !window.isDestroyed()) window.destroy(); }
});
