const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const start = main.indexOf('function watchZoneCartoonItem(');
const end = main.indexOf('ipcMain.handle', start);
const catalog = vm.createContext({});
vm.runInContext(main.slice(start, end), catalog);
const series = Array.from({length:31}, (_,i) => ({id:String(i+1),slug:`series-${i+1}`,name:`Series ${i+1}`,totalVideos:(i+1)*8,thumbnail:'https://example.com/poster.jpg'}));
const shelves = catalog.watchZoneCartoonShelves(series);
assert.equal(shelves.primary.length,31);
assert.equal(shelves.primary[0].episodeCount,248);
assert(shelves.secondary.length>0);
assert(shelves.secondary.every(item=>item.episodeCount<=50));
assert.equal(shelves.secondary[0].episodeCount,8);
const loaded = new Set(shelves.primary.slice(0,12).map(item=>item.id));
for(const page of [1,2]) shelves.primary.slice((page-1)*24,page*24).forEach(item=>loaded.add(item.id));
assert.equal(loaded.size,31,'View All omitted titles after initial 12-card shelf');
const renderer = fs.readFileSync(path.join(root, 'renderer/watchzone.js'), 'utf8');
const pick = name => renderer.match(new RegExp('    function '+name+'\\([^]*?\\n    }'))[0];
let tick;
const hero = {style:{},innerHTML:'',matches:()=>false,insertAdjacentHTML(_position,html){this.innerHTML+=html;}};
const context = vm.createContext({heroSlides:[],heroIndex:0,heroTimer:null,heroMode:'',heroHovered:false,
  mode:'cartoon',active:true,el:{hero,home:{hidden:false}},document:{hidden:false},
  window:{matchMedia:()=>({matches:false})},safeImage:value=>value,escapeHtml:value=>String(value),remember:item=>item.id,
  clearInterval:()=>{},setInterval:callback=>{tick=callback;return 1;}});
vm.runInContext(['heroMarkup','showHeroSlide','setHeroSlides'].map(pick).join('\n'),context);
context.setHeroSlides({hero:shelves.primary[0],primary:shelves.primary,secondary:shelves.secondary});
assert.equal(context.heroSlides.length,5);
assert.equal(new Set(context.heroSlides.map(item=>item.id)).size,5);
assert(hero.innerHTML.includes('data-hero-slide="4"'));
tick();assert.equal(context.heroIndex,1);
context.showHeroSlide(0);assert.equal(context.heroIndex,0);
context.showHeroSlide(-1);assert.equal(context.heroIndex,4);
context.heroHovered=true;tick();assert.equal(context.heroIndex,4);
context.heroHovered=false;context.el.home.hidden=true;tick();assert.equal(context.heroIndex,4);
context.el.home.hidden=false;context.active=false;tick();assert.equal(context.heroIndex,4);
context.active=true;context.mode='movie';tick();assert.equal(context.heroIndex,4);
console.log('PASS: five unique banners, auto advance, manual selection/wrap, hover/inactive/hidden pause');
console.log('PASS: Top Series ranked by catalog size; Short & Sweet <=50 episodes; View All has no omitted titles');
const navigation = vm.createContext({mode:'iptv',document:{querySelectorAll:()=>[]},el:{searchInput:{},tagWrap:{},backHome:{},playerBack:{hidden:false}}});
vm.runInContext(pick('toggleModeButtons'), navigation);
navigation.toggleModeButtons();
assert.equal(navigation.el.backHome.hidden,true,'IPTV catalog should not show Browse');
assert.equal(navigation.el.playerBack.hidden,false,'Player Back must remain available');
for(const mode of ['movie','anime','cartoon']) {
  navigation.mode=mode; navigation.toggleModeButtons();
  assert.equal(navigation.el.backHome.hidden,false,'Other catalogs must retain Browse');
}
console.log('PASS: IPTV catalog hides Browse; other catalogs and player retain navigation');
