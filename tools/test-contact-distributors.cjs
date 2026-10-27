const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
for (const output of [process.stdout, process.stderr]) output.on('error', () => app.exit(1));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
    let window;
    try {
        window = new BrowserWindow({ show: false, width: 1200, height: 650, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, partition: 'contact-test-' + Date.now() } });
        await window.loadURL('about:blank');
        window.webContents.debugger.attach('1.3');
        await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        const css = fs.readFileSync(path.join(__dirname, '../renderer/modules.css'), 'utf8');
        const script = fs.readFileSync(path.join(__dirname, '../renderer/contact.js'), 'utf8');
        await window.webContents.executeJavaScript(`(() => {
            document.head.innerHTML = '<style>' + ${JSON.stringify(css)} + '</style>';
            document.body.innerHTML = '<div id="contactGrid"></div><section style="width:900px" id="contactTest"><div id="contactDistributorViewport" class="contact-distributor-viewport"><div id="contactDistributorTrack" class="contact-distributor-track"><div id="contactDistributorGroup" class="contact-distributor-group"></div></div></div><p id="contactDistributorStatus"></p></section><div id="contactDiscord"></div>';
            window.electronAPI = { invoke: async channel => channel === 'app-distributors' ? { success: true, items: Array.from({length:5}, (_,i)=>({ name: i===0 ? '<Test Name>' : 'Distributor '+i, picture: '' })) } : { success:true, data:{cards:[]} } };
            ${script}
        })()`);
        const inspect = () => window.webContents.executeJavaScript(`(() => {
            const viewport=document.getElementById('contactDistributorViewport');
            return { reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, moving:viewport.classList.contains('is-moving'), width:viewport.clientWidth, group:document.getElementById('contactDistributorGroup').scrollWidth, copies:document.querySelectorAll('[data-distributor-copy]').length, cards:document.getElementById('contactDistributorGroup').children.length, name:document.querySelector('figcaption').textContent, initial:document.querySelector('.contact-distributor-portrait').textContent };
        })()`);
        const settle = async () => {
            await new Promise(resolve => setTimeout(resolve, 1200));
            await window.webContents.executeJavaScript('document.body.offsetWidth');
        };
        await settle();
        const wide=await inspect();
        assert.equal(wide.moving,false); assert.equal(wide.copies,0); assert.equal(wide.cards,5);
        assert.equal(wide.name,'<Test Name>'); assert.ok(wide.initial);
        await window.webContents.executeJavaScript("document.getElementById('contactTest').style.width='440px'");
        await settle();
        const narrow=await inspect();
        console.log(JSON.stringify({wide,narrow}));
        assert.equal(narrow.width,440); assert.equal(narrow.moving,true); assert.equal(narrow.copies,1);
        await window.webContents.executeJavaScript("document.getElementById('contactTest').style.width='1000px'");
        await settle();
        console.log(JSON.stringify({expanded:await inspect()}));
        assert.equal((await inspect()).moving,false); assert.equal((await inspect()).copies,0);
        await window.webContents.executeJavaScript("document.getElementById('contactTest').style.display='none'");
        await settle();
        assert.equal((await inspect()).moving,false);
        await window.webContents.executeJavaScript("document.getElementById('contactTest').style.display='block';document.getElementById('contactTest').style.width='440px'");
        await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await settle();
        assert.equal((await inspect()).moving,false);
        assert.equal((await inspect()).copies,0);
        console.log(JSON.stringify({passed:true,wide,narrow,resize:true,hidden:true,safeNames:true}));
        window.destroy(); app.exit(0);
    } catch(error) { console.error(error); if(window) window.destroy(); app.exit(1); }
});
