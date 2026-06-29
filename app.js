// Flash Nigeria main app logic - split from index.html
const API='https://www.flashnigeria.com/api/news', CACHE_K='fn6_c', OFFLINE_K='fn6_off', CACHE_TTL=2*60*1000;
const SAVED_K='fn5_sv', THEME_K='fn5_theme', PIDGIN_K='fn5_pidgin';
const SRCH_HIST_K='fn5_sh', NOTIF_K='fn5_notif', POLL_K='fn5_poll', CLICKS_K='fn5_clicks';
const RATE_K='fn5_rates', RATE_TTL=60*60*1000; // rates cache 1hr

let arts=[], saved=JSON.parse(localStorage.getItem(SAVED_K)||'[]');
let cat='', view='feed', nextPg=null, busy=false;
let deferredInstall=null, curArt=null, pendingArts=[], pidginOn=false;
let clickCounts=JSON.parse(localStorage.getItem(CLICKS_K)||'{}');

// ── SVG ICONS ──
function waIco(){return`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`;}
function xIco(){return`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.252 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;}

// ── BOOT ──
document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(); initWelcomeBar();
  bindNav(); bindCats(); bindSearch(); bindInstall(); bindPTR();
  bindModal(); bindVoice(); bindDarkMode();
  bindNotifications(); bindOffline();
  // Check if already allowed and fire test notif
  if(Notification.permission==='granted' && 'serviceWorker' in navigator && localStorage.getItem('fn_notif_off')!=='1'){
    navigator.serviceWorker.ready.then(reg => {
      if(reg.active){
        reg.active.postMessage({type:'CHECK_NEWS'});
      }
    });
  }
  // Update notification UI when about page is viewed
  setTimeout(function(){ updateNotifUI(); updateNotifHdrBtn(); }, 500);
  renderSaved(); loadNews();
  loadRates(); initPoll(); startNewCheck(); initFlashAuth();
  document.getElementById('mo-wa').innerHTML=waIco()+' WA';
  document.getElementById('mo-xi').innerHTML=xIco()+' X';
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredInstall=e;
    document.getElementById('install-bar').style.display='flex';
  });
});

// ── WELCOME BAR ──
function initWelcomeBar(){
  if(localStorage.getItem('fn_wb')) return;
  setTimeout(()=>{
    document.getElementById('welcome-bar').classList.add('show');
    setTimeout(()=>document.getElementById('welcome-bar').classList.remove('show'), 5000);
  }, 2000);
  document.getElementById('wb-x').addEventListener('click',()=>{
    document.getElementById('welcome-bar').classList.remove('show');
    localStorage.setItem('fn_wb','1');
  });
  localStorage.setItem('fn_wb','1');
}


// ── VOICE PANEL PIDGIN TOGGLE ──
function toggleVPPidgin(){
  pidginOn = !pidginOn;
  localStorage.setItem(PIDGIN_K, pidginOn ? '1' : '0');
  const btn = document.getElementById('vp-pidgin-btn');
  if(btn){
    btn.style.background = pidginOn ? 'var(--gold)' : 'var(--bg)';
    btn.style.color = pidginOn ? '#fff' : 'var(--ink3)';
    btn.style.borderColor = pidginOn ? 'var(--gold)' : 'var(--border2)';
    btn.textContent = pidginOn ? '🗣️ PIDGIN ON' : '🗣️ PIDGIN';
  }
  // Update rendered results if any
  if(vpArts.length) renderVPCards(vpArts);
  toast(pidginOn ? '🗣️ Pidgin mode on — headlines in Naija!' : 'Pidgin off');
}

// Sync VP pidgin button state on open
function syncVPPidginBtn(){
  const btn = document.getElementById('vp-pidgin-btn');
  if(!btn) return;
  btn.style.background = pidginOn ? 'var(--gold)' : 'var(--bg)';
  btn.style.color = pidginOn ? '#fff' : 'var(--ink3)';
  btn.style.borderColor = pidginOn ? 'var(--gold)' : 'var(--border2)';
  btn.textContent = pidginOn ? '🗣️ PIDGIN ON' : '🗣️ PIDGIN';
}

// ── OFFLINE ──
function bindOffline(){
  window.addEventListener('offline',()=>{
    document.getElementById('offline-bar').classList.add('show');
    serveOfflineCache();
  });
  window.addEventListener('online',()=>{
    document.getElementById('offline-bar').classList.remove('show');
    toast('✅ Back online!');
    hardRefresh();
  });
}
function saveOfflineCache(articles){
  const top20=articles.slice(0,30);
  localStorage.setItem(OFFLINE_K,JSON.stringify({ts:Date.now(),d:top20}));
}
function serveOfflineCache(){
  try{
    const c=JSON.parse(localStorage.getItem(OFFLINE_K));
    if(c&&c.d?.length){arts=c.d; renderFeed(); toast('📡 Showing cached stories');}
  }catch(e){}
}

// ── DARK MODE ──
function applyTheme(){
  const dark=localStorage.getItem(THEME_K)==='dark';
  document.body.classList.toggle('dark',dark);
  document.getElementById('theme-meta').content=dark?'#0f0f0f':'#ffffff';
  updateDarkIcon(dark);
}
function updateDarkIcon(dark){
  document.getElementById('dark-ico').innerHTML=dark
    ?'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    :'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}
function bindDarkMode(){
  document.getElementById('dark-btn').addEventListener('click',()=>{
    const isDark=document.body.classList.toggle('dark');
    localStorage.setItem(THEME_K,isDark?'dark':'light');
    document.getElementById('theme-meta').content=isDark?'#0f0f0f':'#ffffff';
    // Also update apple status bar
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content=isDark?'black':'default';
    updateDarkIcon(isDark);
    toast(isDark?'🌙 Dark mode on':'☀️ Light mode on');
  });
}

// ── PIDGIN MODE ──
const PIDGIN_MAP=[
  ['Federal Government','Federal Goment'],
  ['the Federal Government','Federal Goment'],
  ['President Tinubu','Oga Tinubu'],
  ['President ','Oga President '],
  ['Vice President','Oga Vice'],
  ['Governor ','Govnor '],
  ['Senator ','Senator '],
  ['Nigeria ','Naija '],
  ['Nigerians','Naija pipo'],
  ['Nigerian ','Naija '],
  ['government','goment'],
  ['has announced','don announce'],
  ['announced','don announce'],
  ['have announced','don announce'],
  ['was arrested','don carry go'],
  ['has been arrested','don carry go'],
  ['arrested','don carry go'],
  ['was killed','don die'],
  ['has been killed','don die'],
  ['killed','don die'],
  ['died','don die'],
  ['has died','don die'],
  ['was injured','don wound'],
  ['injured','don wound'],
  ['has resigned','don resign'],
  ['resigned','don resign'],
  ['suspended','don suspend'],
  ['sacked','don sack'],
  ['jailed','don go jail'],
  ['sentenced','don get sentence'],
  ['convicted','don guilty'],
  ['confirmed','don confirm'],
  ['signed','don sign'],
  ['approved','don approve'],
  ['rejected','don reject'],
  ['dismissed','don dismiss'],
  ['accused','don accuse'],
  ['warned','don warn'],
  ['ordered','don order'],
  ['launched','don launch'],
  ['revealed','don reveal'],
  ['denied','don deny'],
  ['promised','don promise'],
  ['says','talk say'],
  ['said','talk say'],
  ['stated','tok say'],
  ['claims','talk say'],
  ['will be','go be'],
  ['has been','don'],
  ['have been','don'],
  ['fuel price','fuel price wahala'],
  ['corruption','corruption wahala'],
  ['scandal','big wahala'],
  ['crisis','big wahala'],
  ['immediately','sharp sharp'],
  ['again','again again'],
  ['police','police pipo'],
  ['army','army pipo'],
  ['court','court'],
  ['money','moni'],
  ['billion','billion naira'],
  ['million','million naira'],
]

function toPidgin(text){
  if(!text || !pidginOn) return text;
  var t = text;
  for(var i=0; i<PIDGIN_MAP.length; i++){
    var find = PIDGIN_MAP[i][0];
    var replace = PIDGIN_MAP[i][1];
    // Case-insensitive replacement using regex
    try{
      var re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
      t = t.replace(re, function(match){
        // Preserve original case style
        if(match === match.toUpperCase()) return replace.toUpperCase();
        if(match[0] === match[0].toUpperCase()) return replace[0].toUpperCase() + replace.slice(1);
        return replace;
      });
    }catch(e){ t = t.split(find).join(replace); }
  }
  return t;
}
function applyPidgin(){
  pidginOn=localStorage.getItem(PIDGIN_K)==='1';
  const btn=document.getElementById('pidgin-btn');
  if(btn){
    btn.classList.toggle('on',pidginOn);
    btn.textContent = pidginOn ? '🗣️ PIDGIN ON' : '🗣️ PIDGIN';
    btn.style.background = pidginOn ? 'var(--gold)' : 'var(--bg)';
    btn.style.color = pidginOn ? '#fff' : 'var(--ink3)';
    btn.style.borderColor = pidginOn ? 'var(--gold)' : 'var(--border2)';
  }
}
function togglePidgin(){
  pidginOn = !pidginOn;
  localStorage.setItem(PIDGIN_K, pidginOn ? '1' : '0');
  applyPidgin();
  // Re-render feed so headlines update immediately
  if(typeof renderFeed === 'function') renderFeed();
  // Sync VP pidgin button too
  const vpBtn = document.getElementById('vp-pidgin-btn');
  if(vpBtn){
    vpBtn.style.background = pidginOn ? 'var(--gold)' : 'var(--bg)';
    vpBtn.style.color = pidginOn ? '#fff' : 'var(--ink3)';
    vpBtn.style.borderColor = pidginOn ? 'var(--gold)' : 'var(--border2)';
    vpBtn.textContent = pidginOn ? '🗣️ PIDGIN ON' : '🗣️ PIDGIN';
  }
  toast(pidginOn ? '🗣️ Pidgin mode on — headlines in Naija!' : 'Pidgin off');
}
function getTitle(a){return pidginOn?toPidgin(a.title):a.title;}

// ── NAV ──
function bindNav(){document.querySelectorAll('.ni').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.v)));}
function switchView(v){
  view=v;
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('on'));
  document.getElementById(v+'-view').classList.add('on');
  document.querySelector(`.ni[data-v="${v}"]`).classList.add('on');
  document.getElementById('main').scrollTop=0;
  const isAbout=(v==='about'||v==='profile');
  document.getElementById('ticker').style.display=isAbout?'none':'';
  document.getElementById('cats').style.display=isAbout?'none':'';
  document.getElementById('rate-bar').style.display=isAbout?'none':'';
  document.getElementById('new-banner').classList.remove('show');
  if(v==='myfeed') renderMyFeed();
}


// ── CATS ──
function bindCats(){
  document.querySelectorAll('.pill').forEach(p=>{
    p.addEventListener('click',()=>{
      document.querySelectorAll('.pill').forEach(x=>x.classList.remove('on'));
      p.classList.add('on'); cat=p.dataset.cat; arts=[]; nextPg=null; loadNews();
    });
  });
}

// ── TRENDING ──
const TRENDING_KW=['breaking','just in','urgent','dead','killed','crash','fire','bomb','attack','arrest','resign','impeach','naira','fuel','election','super eagles','world cup','tinubu','senate','court'];
function trendScore(a){const t=(a.title||'').toLowerCase(); return TRENDING_KW.filter(w=>t.includes(w)).length;}
function isTrending(a){return trendScore(a)>=2;}
function readTime(desc){if(!desc)return''; const w=desc.split(' ').length; return Math.max(1,Math.ceil(w/200))+'min';}

// ── LOAD NEWS ──
async function loadNews(paginate=false){ // always returns Promise
  if(busy)return; busy=true;
  if(!navigator.onLine){serveOfflineCache(); busy=false; return;}
  if(!paginate){renderSkeletons(); document.getElementById('hero-box').innerHTML='';}
  if(!paginate&&!cat){const c=getCache(); if(c){arts=c; renderFeed(); updateCatCounts(); renderMostRead(); busy=false; return;} }
  spinning(true);
  try{
    const p=new URLSearchParams();
    if(cat) p.set('category',cat);
    if(paginate&&nextPg) p.set('page',nextPg);
    const r=await fetch(`${API}?${p}&_=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(d.status==='ok'){
      const fresh=d.articles||[];
      arts=paginate?[...arts,...fresh]:fresh;
      nextPg=d.nextPage||null;
      if(!paginate&&!cat){setCache(fresh); saveOfflineCache(fresh);}
      updateTicker(fresh); renderFeed(); updateCatCounts();
      if(!paginate) renderMostRead(); // Breaking strip: load once only
      if(typeof renderFlashDashboard==='function') renderFlashDashboard();
      // Show/hide Load More button
      var lmBtn = document.getElementById('load-more');
      if(lmBtn){ lmBtn.style.display = nextPg ? 'block' : 'none'; lmBtn.textContent='Load More Stories'; lmBtn.disabled=false; }
    } else throw new Error(d.message||'API error');
  }catch(e){
    if(!paginate) renderErr(e.message);
    else toast('⚠️ Could not load more');
  }
  spinning(false); busy=false;
}

function setCache(d){localStorage.setItem(CACHE_K,JSON.stringify({ts:Date.now(),d}));}
function getCache(){
  try{const c=JSON.parse(localStorage.getItem(CACHE_K)); if(c&&Date.now()-c.ts<CACHE_TTL)return c.d;}catch{}
  return null;
}

// ── NEW STORIES CHECK ──
function startNewCheck(){
  setInterval(async()=>{
    if(view!=='feed'||busy||!navigator.onLine) return;
    try{
      const r=await fetch(`${API}?_=${Date.now()}`, {cache:'no-store'}); const d=await r.json();
      if(d.status==='ok'&&d.articles?.length){
        const newIds=d.articles.filter(a=>!arts.find(x=>x.id===a.id));
        if(newIds.length>0){
          pendingArts=d.articles;
          document.getElementById('new-banner-txt').textContent=`⚡ ${newIds.length} new stor${newIds.length===1?'y':'ies'} available`;
          document.getElementById('new-banner').classList.add('show');
        }
      }
    }catch(e){}
  },3*60*1000);
  document.getElementById('new-banner').addEventListener('click',()=>{
    document.getElementById('new-banner').classList.remove('show');
    if(pendingArts.length){arts=pendingArts; pendingArts=[]; renderFeed(); renderMostRead();}
    else{localStorage.removeItem(CACHE_K); arts=[]; nextPg=null; loadNews();}
    document.getElementById('main').scrollTop=0;
  });
}

// ── CAT COUNTS ──
function updateCatCounts(){
  document.querySelectorAll('.pill[data-cat]').forEach(p=>{
    const c=p.dataset.cat;
    if(!c){p.innerHTML='All'; return;}
    const n=arts.filter(a=>a.cat===c).length;
    p.innerHTML=c.charAt(0).toUpperCase()+c.slice(1)+(n?`<span class="pill-count">${n}</span>`:'');
  });
}

// ── MOST READ ──
function trackClick(id){
  if(typeof gtag!=='undefined') gtag('event','article_click',{article_id:id});
  clickCounts[id]=(clickCounts[id]||0)+1;
  localStorage.setItem(CLICKS_K,JSON.stringify(clickCounts));
}
function renderMostRead(){
  // Use arts already loaded — pick latest 1 per source, no extra fetch
  const wrap=document.getElementById('most-read');
  const strip=document.getElementById('mr-strip');
  if(!arts.length){ wrap.style.display='none'; return; }
  // Sort all by date newest first
  const sorted=[...arts].sort((a,b)=>new Date(b.pub)-new Date(a.pub));
  // Pick latest 1 per source
  const seen={};
  const top=[];
  for(const a of sorted){
    if(!seen[a.source]){
      seen[a.source]=true;
      top.push(a);
    }
  }
  // Sort picked articles by time — newest leads
  top.sort((a,b)=>new Date(b.pub)-new Date(a.pub));
  wrap.style.display='block';
  strip.innerHTML=top.map((a)=>`
    <div class="mr-card" data-id="${a.id}">
      <div class="brk-dot"></div>
      ${a.img&&a.img.startsWith('http')?`<img class="mr-img" src="${a.img}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:''}
      <div class="mr-img-ph" style="${a.img&&a.img.startsWith('http')?'display:none':''}">
        ${catEmoji(a.cat)}
      </div>
      <div class="mr-body">
        <div class="mr-src">${a.source}</div>
        <div class="mr-hl">${getTitle(a)}</div>
        <div class="mr-ago">${ago(a.pub)}</div>
      </div>
    </div>`).join('');
  strip.querySelectorAll('.mr-card').forEach((el,i)=>{
    el.addEventListener('click',()=>{trackClick(top[i].id); openArt(top[i]);});
  });
}

// ── NAIRA RATES ──
async function loadRates(){
  try{
    const c=JSON.parse(localStorage.getItem(RATE_K));
    if(c&&Date.now()-c.ts<RATE_TTL){displayRates(c.d); return;}
  }catch(e){}
  try{
    // Fetch exchange rates + BTC in parallel
    const [fxRes, btcRes] = await Promise.allSettled([
      fetch('https://api.exchangerate-api.com/v4/latest/USD'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    ]);
    const rates = {usd:1612, eur:1750, gbp:2060, btc:'103,420'};
    if(fxRes.status==='fulfilled' && fxRes.value.ok){
      const d=await fxRes.value.json();
      const ngn=d.rates.NGN||1612;
      rates.usd=Math.round(ngn);
      rates.eur=Math.round(ngn/(d.rates.EUR||0.92));
      rates.gbp=Math.round(ngn/(d.rates.GBP||0.79));
    }
    if(btcRes.status==='fulfilled' && btcRes.value.ok){
      const b=await btcRes.value.json();
      const btcPrice=b?.bitcoin?.usd;
      if(btcPrice) rates.btc=Math.round(btcPrice).toLocaleString();
    }
    localStorage.setItem(RATE_K,JSON.stringify({ts:Date.now(),d:rates}));
    displayRates(rates);
  }catch(e){
    displayRates({usd:1612,eur:1750,gbp:2060,btc:'103,420'});
  }
}
function displayRates(r){
  document.getElementById('rate-usd').textContent='₦'+r.usd.toLocaleString();
  document.getElementById('rate-eur').textContent='₦'+r.eur.toLocaleString();
  document.getElementById('rate-gbp').textContent='₦'+r.gbp.toLocaleString();
  document.getElementById('rate-btc').textContent='$'+r.btc.toLocaleString();
}

// ── POLL OF THE DAY ──
const POLLS=[
  {q:"Do you support the current fuel price in Nigeria?",opts:["Yes, it's fair","No, reduce am"]},
  {q:"Which party will win the 2027 presidential election?",opts:["APC","PDP","Labour Party","Not sure"]},
  {q:"Is Nigeria's economy improving under Tinubu?",opts:["Yes, I see improvement","No, things worse","Too early to say"]},
  {q:"Should Nigeria switch to cryptocurrency for transactions?",opts:["Yes, e go help","No, too risky","Maybe in future"]},
  {q:"Which is more important for Nigeria right now?",opts:["Security","Economy","Education","Healthcare"]},
  {q:"Do you trust Nigerian news media?",opts:["Yes, mostly","No, dem dey lie","Sometimes only"]},
];

function initPoll(){
  const today=new Date().toISOString().slice(0,10);
  let state={};
  try{state=JSON.parse(localStorage.getItem(POLL_K)||'{}');}catch(e){}
  if(state.date!==today){state={date:today,idx:Math.floor(Math.random()*POLLS.length),votes:{}};}
  const poll=POLLS[state.idx];
  if(!poll) return;
  const wrap=document.getElementById('poll-wrap');
  wrap.style.display='block';
  const totalVotes=Object.values(state.votes||{}).reduce((a,b)=>a+b,0);
  const voted=state.myVote!=null;
  wrap.innerHTML=`<div class="poll-card">
    <div class="poll-hd"><span class="poll-badge">📊 Poll</span><span style="font-size:11px;color:var(--ink4)">Today's question</span></div>
    <div class="poll-q">${poll.q}</div>
    <div class="poll-opts">${poll.opts.map((o,i)=>{
      const v=state.votes?.[i]||0;
      const pct=totalVotes?Math.round(v/totalVotes*100):0;
      const isMyVote=state.myVote===i;
      return`<button class="poll-opt ${voted?(isMyVote?'voted':'losing'):''}" data-i="${i}">
        ${voted?`<div class="poll-bar" style="width:${pct}%"></div>`:''}
        <div class="poll-opt-inner">
          <span>${o}</span>
          ${voted?`<span class="poll-pct">${pct}%</span>`:''}
        </div>
      </button>`;
    }).join('')}</div>
    ${totalVotes?`<div class="poll-total">${totalVotes} vote${totalVotes!==1?'s':''} so far</div>`:''}
  </div></div>`;
  if(!voted){
    wrap.querySelectorAll('.poll-opt').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i=parseInt(btn.dataset.i);
        state.votes=state.votes||{};
        state.votes[i]=(state.votes[i]||0)+1;
        state.myVote=i;
        localStorage.setItem(POLL_K,JSON.stringify(state));
        initPoll();
        toast('✅ Vote recorded — thanks!');
        if(navigator.vibrate) navigator.vibrate(15);
      });
    });
  }
}

// ── RENDER FEED ──
function renderFeed(){
  const list=document.getElementById('card-list'), heroBox=document.getElementById('hero-box');
  if(!arts.length){
    heroBox.innerHTML='';
    list.innerHTML=`<div class="mty" style="grid-column:1/-1"><div class="ico">📭</div><p>No stories found.<br>Try a different category.</p></div>`;
    document.getElementById('load-more').style.display='none'; return;
  }
  heroBox.innerHTML=heroHTML(arts[0]);
  document.getElementById('hero-card').addEventListener('click',e=>{
    if(e.target.closest('.hero-share'))return;
    trackClick(arts[0].id); openArt(arts[0]);
  });
  document.getElementById('hero-wa').addEventListener('click',e=>{e.stopPropagation(); shareWA(arts[0]);});
  document.getElementById('hero-xi').addEventListener('click',e=>{e.stopPropagation(); shareX(arts[0]);});
  document.getElementById('hero-img-share').addEventListener('click',e=>{e.stopPropagation(); shareAsImage(arts[0]);});
  const rest=arts.slice(1);
  const fithernova_ad = `<div onclick="window.open('https://fither-app-one.vercel.app','_blank')" style="margin:0;background:linear-gradient(135deg,#0a1a0f,#051008);border-top:1.5px solid rgba(22,163,74,0.25);border-bottom:1.5px solid rgba(22,163,74,0.25);padding:12px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;grid-column:1/-1;">
    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#16a34a,#15803d);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="font-size:18px;">💪</span>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
        <span style="font-family:var(--font-hd);font-size:14px;font-weight:900;color:#fff;letter-spacing:.02em;">FitHerNova</span>
        <span style="font-size:10px;font-weight:700;color:#16a34a;background:rgba(22,163,74,0.15);padding:1px 6px;border-radius:4px;border:1px solid rgba(22,163,74,0.3);">Sponsored</span>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,0.6);margin:0;">Women's wellness app — workouts, Naija food tracker & AI coach</p>
    </div>
    <span style="font-size:18px;color:#16a34a;flex-shrink:0;">›</span>
  </div>`;

  // Inject ad after 5th card
  const cards = rest.map((a,i) => cardHTML(a,i));
  if(cards.length > 5) cards.splice(5, 0, fithernova_ad);
  list.innerHTML = cards.join('');
  list.querySelectorAll('.nc').forEach((el,i)=>{
    // Skip the ad element
    const realIdx = i < 5 ? i : i - 1;
    if(realIdx < rest.length) bindCard(el, rest[realIdx]);
  });
  const lm=document.getElementById('load-more');
  lm.style.display=nextPg?'block':'none';
  // onclick is bound once in init — do NOT rebind here
}

function heroHTML(a){
  const{cc}=catColors(a.cat); const trending=isTrending(a); const rt=readTime(a.desc);
  const title=getTitle(a);
  const badgeClass = cc||'default';
  return`<div class="hero-wrap"><div class="hero" id="hero-card">
    <div class="hero-img">
      ${a.img?`<img src="${a.img}" alt="" loading="eager" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:``}
      <div class="hero-img-ph" style="${a.img?'display:none':''}">${catEmoji(a.cat)}</div>
      <div class="hero-overlay">
        <div>
          ${trending?`<span class="trending-badge">🔥 Trending</span>`:''}
          ${a.cat?`<div class="cat-badge ${badgeClass}">${a.cat.toUpperCase()}</div>`:''}
        </div>
        <div class="hero-hl">${title}</div>
        <div class="hero-meta">
          <div class="src-dot"></div>
          <span class="hero-src">${a.source}</span>
          <span class="hero-time">${ago(a.pub)}</span>
          ${rt?`<span class="read-time">· ⏱ ${rt}</span>`:''}
        </div>
      </div>
    </div>
    <div class="hero-actions">
      <span class="hero-desc-small">${a.desc||'Tap to read the full story'}</span>
      <div class="share-group hero-share">
        <button class="wa-btn" id="hero-wa">${waIco()} WA</button>
        <button class="x-btn" id="hero-xi">${xIco()} X</button>
        <button class="img-btn" id="hero-img-share">🖼️</button>
      </div>
    </div>
  </div></div>`;
}

function cardHTML(a,i){
  const{cc}=catColors(a.cat); const isSv=saved.some(s=>s.id===a.id);
  const trending=isTrending(a); const rt=readTime(a.desc); const title=getTitle(a);
  const tagClass=cc||'';
  return`<div class="nc">
    <div class="nc-img" style="${['entertainment','sports','politics','business'].includes(a.img)?`background:${a.img==='entertainment'?'linear-gradient(135deg,#7c3aed,#a855f7)':a.img==='sports'?'linear-gradient(135deg,#059669,#10b981)':a.img==='politics'?'linear-gradient(135deg,#1d4ed8,#3b82f6)':'linear-gradient(135deg,#d97706,#f59e0b)'}`:''}">
      ${!['entertainment','sports','politics','business'].includes(a.img)&&a.img?`<img src="${a.img}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:``}
      <div class="nc-img-ph" style="${!['entertainment','sports','politics','business'].includes(a.img)&&a.img?'display:none':''};font-size:32px;">${['entertainment','sports','politics','business'].includes(a.img)?catEmoji(a.img):catEmoji(a.cat)}</div>
      ${trending?`<div class="nc-fire">🔥</div>`:''}
    </div>
    <div class="nc-body">
      <div class="nc-top">
        <div class="nc-meta">
          <span class="nc-src">${a.source}</span>
          <div class="nc-dot"></div>
          <span class="nc-time">${ago(a.pub)}</span>
          ${rt?`<span class="nc-rt">⏱${rt}</span>`:''}
        </div>
        <div class="nc-hl">${title}</div>
        ${a.cat?`<span class="nc-tag ${tagClass}">${a.cat.toUpperCase()}</span>`:''}
      </div>
      <div class="nc-acts">
        <button class="nc-act sv-act ${isSv?'sv':''}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="${isSv?'currentColor':'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>${isSv?'Saved':'Save'}
        </button>
        <button class="nc-act wa nc-wa">${waIco()} WA</button>
        <button class="nc-act xi nc-xi">${xIco()} X</button>
        <button class="nc-act cp nc-cp">🖼️</button>
      </div>
    </div>
  </div>`;
}

function bindCard(el,a){
  el.addEventListener('click',e=>{if(e.target.closest('.nc-act'))return; trackClick(a.id); openArt(a);});
  el.querySelector('.sv-act').addEventListener('click',e=>{e.stopPropagation(); toggleSave(a,el.querySelector('.sv-act'));});
  el.querySelector('.nc-wa').addEventListener('click',e=>{e.stopPropagation(); shareWA(a);});
  el.querySelector('.nc-xi').addEventListener('click',e=>{e.stopPropagation(); shareX(a);});
  el.querySelector('.nc-cp').addEventListener('click',e=>{e.stopPropagation(); shareAsImage(a);});
  el.addEventListener('touchstart',()=>{if(navigator.vibrate) navigator.vibrate(8);},{passive:true});
}

function renderSkeletons(){
  document.getElementById('hero-box').innerHTML=`<div class="hero-wrap"><div style="background:var(--card);border-radius:12px;box-shadow:var(--shadow-s);overflow:hidden"><div class="sk" style="height:215px;border-radius:0"></div><div style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="sk sk-ln s"></div><div class="sk sk-ln f t"></div><div class="sk sk-ln m t"></div><div class="sk sk-ln s"></div></div></div></div>`;
  document.getElementById('card-list').innerHTML=Array(8).fill('').map(()=>`<div class="sk-card"><div class="sk sk-img"></div><div class="sk-bd"><div class="sk sk-ln s"></div><div class="sk sk-ln f t"></div><div class="sk sk-ln m"></div></div></div>`).join('');
}
function renderErr(msg){
  document.getElementById('hero-box').innerHTML='';
  document.getElementById('card-list').innerHTML=`<div class="err-s" style="grid-column:1/-1"><div class="ico">📡</div><p>Couldn't load stories.<br>${msg?msg+'<br>':''}Check your connection.</p><button class="retry" onclick="loadNews()">Try Again</button></div>`;
}
function updateTicker(items){
  if(!items.length) return;
  const hl=items.slice(0,8).map(a=>getTitle(a));
  document.getElementById('ticker-track').innerHTML=[...hl,...hl].map(h=>`<span class="ticker-item">${h} <span style="opacity:.3">◆</span> </span>`).join('');
}
document.getElementById('feed-rfsh').addEventListener('click',hardRefresh);
document.getElementById('rfsh-btn').addEventListener('click',hardRefresh);
function hardRefresh(){localStorage.removeItem(CACHE_K); arts=[]; nextPg=null; loadNews();}
function spinning(on){document.getElementById('rfsh-ico').style.animation=on?'spin .8s linear infinite':'';}
function toggleSave(a,btn){
  const idx=saved.findIndex(s=>s.id===a.id);
  if(idx===-1){saved.unshift(a); toast('📌 Article saved'); if(btn){btn.classList.add('sv'); btn.querySelector('svg').setAttribute('fill','currentColor'); btn.lastChild.textContent=' Saved';}}
  else{saved.splice(idx,1); toast('Removed from saved'); if(btn){btn.classList.remove('sv'); btn.querySelector('svg').setAttribute('fill','none'); btn.lastChild.textContent=' Save';}}
  localStorage.setItem(SAVED_K,JSON.stringify(saved)); renderSaved(); updateBadge();
}
function renderSaved(){
  updateBadge();
  const list=document.getElementById('sv-list');
  if(!saved.length){list.innerHTML=`<div class="mty"><div class="ico">📭</div><p>No saved articles yet.</p></div>`; return;}
  list.innerHTML=saved.map((a,i)=>cardHTML(a,i)).join('');
  list.querySelectorAll('.nc').forEach((el,i)=>bindCard(el,saved[i]));
}
function updateBadge(){const b=document.getElementById('sv-badge'); b.textContent=saved.length; b.style.display=saved.length?'flex':'none';}
document.getElementById('sv-clr').addEventListener('click',()=>{saved=[]; localStorage.removeItem(SAVED_K); renderSaved(); toast('Saved articles cleared');});
function shareWA(a){
  if(typeof gtag!=='undefined') gtag('event','share',{method:'whatsapp',content_id:a.id});const title=getTitle(a); const txt=`⚡ *${title}*\n\n${a.desc?a.desc.slice(0,130)+'…\n\n':''}${a.link}\n\n_via Flash Nigeria_`; window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');}
function shareX(a){
  if(typeof gtag!=='undefined') gtag('event','share',{method:'twitter',content_id:a.id});const title=getTitle(a); window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(`⚡ ${title}\n\n${a.link}\n\n#Nigeria #FlashNigeria`),'_blank');}
function copyLink(a){navigator.clipboard.writeText(a.link).then(()=>toast('🔗 Link copied!')).catch(()=>toast('Could not copy'));}
const HIST_MAX=5; let srchHist=JSON.parse(localStorage.getItem(SRCH_HIST_K)||'[]'); let sT;
function bindSearch(){
  const inp=document.getElementById('srch-inp'), clr=document.getElementById('srch-x');
  renderSearchHistory();
  inp.addEventListener('input',()=>{clearTimeout(sT); const q=inp.value.trim(); clr.style.display=q?'block':'none'; if(!q){resetSearch(); return;} sT=setTimeout(()=>doSearch(q),420);});
  clr.addEventListener('click',()=>{inp.value=''; clr.style.display='none'; resetSearch(); inp.focus();});
}
function addToHistory(q){srchHist=srchHist.filter(x=>x!==q); srchHist.unshift(q); srchHist=srchHist.slice(0,HIST_MAX); localStorage.setItem(SRCH_HIST_K,JSON.stringify(srchHist)); renderSearchHistory();}
function renderSearchHistory(){
  const box=document.getElementById('srch-history');
  if(!srchHist.length){box.innerHTML=''; return;}
  box.innerHTML='<div style="font-size:11px;color:var(--ink4);font-weight:600;margin-bottom:6px;text-transform:uppercase;">Recent</div>'+srchHist.map((q,i)=>`<div class="sh-chip" data-q="${q}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>${q}<span class="sh-chip-x" data-i="${i}">✕</span></div>`).join('');
  box.querySelectorAll('.sh-chip').forEach(el=>{el.addEventListener('click',e=>{if(e.target.classList.contains('sh-chip-x')){srchHist.splice(parseInt(e.target.dataset.i),1); localStorage.setItem(SRCH_HIST_K,JSON.stringify(srchHist)); renderSearchHistory(); return;} const q=el.dataset.q; document.getElementById('srch-inp').value=q; document.getElementById('srch-x').style.display='block'; doSearch(q);});});
}
function resetSearch(){document.getElementById('srch-res').innerHTML=`<div class="mty"><div class="ico">🔍</div><p>Search headlines, topics<br>or sources from Nigeria</p></div>`; renderSearchHistory();}
async function doSearch(q){
  addToHistory(q); const box=document.getElementById('srch-res');
  box.innerHTML=`<div class="mty"><div class="ico" style="animation:spin .8s linear infinite;display:inline-block">⚡</div><p>Searching…</p></div>`;
  const local=arts.filter(a=>(a.title+' '+(a.desc||'')+' '+a.source).toLowerCase().includes(q.toLowerCase()));
  if(local.length){renderSearchRes(local,box); return;}
  try{const r=await fetch(`${API}?q=${encodeURIComponent(q)}&_=${Date.now()}`, {cache:'no-store'}); const d=await r.json(); if(d.status==='ok'&&d.articles?.length) renderSearchRes(d.articles,box); else box.innerHTML=`<div class="mty"><div class="ico">🔍</div><p>No results for "<strong>${q}</strong>"</p></div>`;}catch{box.innerHTML=`<div class="mty"><div class="ico">📡</div><p>Search failed.</p></div>`;}
}
function renderSearchRes(items,box){box.innerHTML=items.map((a,i)=>cardHTML(a,i)).join(''); box.querySelectorAll('.nc').forEach((el,i)=>bindCard(el,items[i]));}
function bindModal(){
  document.getElementById('mo-back').addEventListener('click',closeArt);
  document.getElementById('mo-wa').addEventListener('click',()=>{if(curArt)shareWA(curArt);});
  document.getElementById('mo-xi').addEventListener('click',()=>{if(curArt)shareX(curArt);});
  document.getElementById('mo-img-share').addEventListener('click',()=>{if(curArt)shareAsImage(curArt);});
}
function openArt(a){
  curArt=a; document.getElementById('mo-src').textContent=a.source;
  const isSv=saved.some(s=>s.id===a.id); const{cc}=catColors(a.cat); const title=getTitle(a); const rt=readTime(a.desc);
  document.getElementById('mo-body').innerHTML=`<div class="mo-tag-row">${a.cat?`<span class="nc-tag ${cc}">${a.cat.toUpperCase()}</span>`:''}<span style="font-size:11px;color:var(--ink4)">${ago(a.pub)}${rt?' · ⏱ '+rt:''}</span></div><div class="mo-hl${pidginOn?' pidgin':''}">${title}</div>${a.img?`<div class="mo-img"><img src="${a.img}" alt="" loading="lazy"></div>`:''}<div class="mo-desc">${a.desc||'No description available.'}</div><div class="mo-cta"><button class="mo-sv ${isSv?'on':''}" id="mo-sv-btn">${isSv?'📌 Saved':'📌 Save'}</button><button class="mo-cp" id="mo-cp-btn">📋 Copy Link</button></div><a href="${a.link}" target="_blank" rel="noopener" class="mo-read">Read Full Story →</a>
    ${renderRelated(a)}`;
  document.getElementById('mo-sv-btn').addEventListener('click',function(){toggleSave(a,null); const ns=saved.some(s=>s.id===a.id); this.textContent=ns?'📌 Saved':'📌 Save'; this.classList.toggle('on',ns);});
  document.getElementById('mo-cp-btn').addEventListener('click',()=>copyLink(a));
  // Reset reading progress
  document.getElementById('modal-progress').style.width='0%';
  document.getElementById('modal').classList.add('on'); document.body.style.overflow='hidden';
  // Bind related story clicks
  setTimeout(()=>{
    document.querySelectorAll('.related-card[data-rid]').forEach(el=>{
      el.addEventListener('click',()=>{
        const art=window._relMap&&window._relMap[el.dataset.rid];
        if(art){closeArt(); setTimeout(()=>openArt(art),150);}
      });
    });
  },100);
}
function closeArt(){document.getElementById('modal').classList.remove('on'); document.body.style.overflow=''; curArt=null;}
function bindInstall(){
  document.getElementById('ib-go').addEventListener('click',async()=>{if(!deferredInstall)return; deferredInstall.prompt(); await deferredInstall.userChoice; document.getElementById('install-bar').style.display='none'; deferredInstall=null;});
  document.getElementById('ib-x').addEventListener('click',()=>document.getElementById('install-bar').style.display='none');
}
function bindPTR(){
  let sy=0,pulling=false; const main=document.getElementById('main'), ptr=document.getElementById('ptr');
  main.addEventListener('touchstart',e=>{if(main.scrollTop===0&&view==='feed'){sy=e.touches[0].clientY; pulling=true;}},{passive:true});
  main.addEventListener('touchmove',e=>{if(pulling&&e.touches[0].clientY-sy>65)ptr.classList.add('on');},{passive:true});
  main.addEventListener('touchend',()=>{if(pulling&&ptr.classList.contains('on')){ptr.classList.remove('on'); hardRefresh();} pulling=false;});
}
function bindNotifications(){
  if(localStorage.getItem(NOTIF_K)) return;
  if(!('Notification' in window)) return;
  if(Notification.permission==='granted'){scheduleNewsCheck(); return;}
  if(Notification.permission==='denied') return;
  setTimeout(()=>{document.getElementById('notif-bar').style.display='flex';},30000);
  document.getElementById('nb-allow').addEventListener('click',async()=>{document.getElementById('notif-bar').style.display='none'; const perm=await Notification.requestPermission(); if(perm==='granted'){toast('🔔 Breaking alerts enabled — max 2/day'); scheduleNewsCheck();}});
  document.getElementById('nb-x').addEventListener('click',()=>{document.getElementById('notif-bar').style.display='none'; localStorage.setItem(NOTIF_K,'dismissed');});
}
function scheduleNewsCheck(){checkForTrending(); setInterval(checkForTrending,30*60*1000);}
async function checkForTrending(){if(Notification.permission!=='granted') return; if('serviceWorker' in navigator&&navigator.serviceWorker.controller){navigator.serviceWorker.controller.postMessage({type:'CHECK_NEWS'});}}
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(e=>console.log('SW unregister:',e));});}
let tT;
function toast(msg){const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('on'); clearTimeout(tT); tT=setTimeout(()=>el.classList.remove('on'),2500);}
function ago(ds){if(!ds)return''; const s=Math.floor((Date.now()-new Date(ds))/1000); if(s<60)return'Just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago';}
function catEmoji(c){return{politics:'🏛️',business:'💼',sports:'⚽',entertainment:'🎬',technology:'💻',health:'🏥',science:'🔬'}[c]||'📰';}
function catColors(c){return{politics:{cc:'red'},business:{cc:''},sports:{cc:'teal'},entertainment:{cc:'purple'},technology:{cc:'blue'},health:{cc:''}}[c]||{cc:''};}
const SRC_MAP={'vanguard':'vanguard','punch':'punch','channels':'channels','channels tv':'channels','guardian':'guardian','premium times':'premiumtimes','daily trust':'dailytrust','leadership':'leadership','nation':'thenation','tribune':'tribune','businessday':'businessday','arise':'arise'};
const CAT_WORDS={
  // Politics
  'politics':'politics','political':'politics','government':'politics',
  'tinubu':'politics','senate':'politics','presidency':'politics',
  'election':'politics','governor':'politics','minister':'politics',
  'judiciary':'politics','court':'politics','supreme court':'politics',
  'efcc':'politics','corruption':'politics','impeach':'politics',
  'national assembly':'politics','house of reps':'politics',
  // Business & Economy
  'business':'business','economy':'business','naira':'business',
  'dollar':'business','inflation':'business','cbn':'business',
  'fuel price':'business','subsidy':'business','oil':'business',
  'stock':'business','market':'business','trade':'business',
  'bank':'business','fintech':'business','startup':'business',
  // Sports
  'sports':'sports','football':'sports','soccer':'sports',
  'super eagles':'sports','eagles':'sports','afcon':'sports',
  'world cup':'sports','premier league':'sports','champions league':'sports',
  'osimhen':'sports','basketball':'sports','athletics':'sports',
  'npfl':'sports','wrestling':'sports',
  // Entertainment & Celebs
  'entertainment':'entertainment','celebrity':'entertainment',
  'celebs':'entertainment','nollywood':'entertainment',
  'music':'entertainment','afrobeats':'entertainment',
  'burna boy':'entertainment','wizkid':'entertainment',
  'davido':'entertainment','movie':'entertainment',
  'award':'entertainment','fashion':'entertainment',
  'bbnaija':'entertainment','big brother':'entertainment',
  // Technology
  'technology':'technology','tech':'technology','crypto':'technology',
  'bitcoin':'technology','ai':'technology','startup':'technology',
  'fintech':'technology','digital':'technology','internet':'technology',
  'software':'technology','cyber':'technology','app':'technology',
  'innovation':'technology','data':'technology','5g':'technology',
  'paystack':'technology','flutterwave':'technology','opay':'technology',
  // Health
  'health':'health','medical':'health','hospital':'health',
  'disease':'health','covid':'health','vaccine':'health',
  'cancer':'health','mental health':'health','wellness':'health',
  'doctor':'health','nurse':'health','ncdc':'health',
  'malaria':'health','cholera':'health','outbreak':'health',
  'ministry of health':'health','who ':'health','epidemic':'health',
  // Security
  'security':'politics','crime':'politics','kidnap':'politics',
  'bandits':'politics','terrorism':'politics','attack':'politics',
  'robbery':'politics','police':'politics','army':'politics',
  'military':'politics','boko haram':'politics','iswap':'politics',
};
let recog=null, synth=window.speechSynthesis, vpArts=[], vpListening=false;
function bindVoice(){
  document.getElementById('voice-fab').addEventListener('click',openVP);
  document.getElementById('vp-close').addEventListener('click',closeVP);
  document.getElementById('vp').addEventListener('click',e=>{if(e.target===document.getElementById('vp'))closeVP();});
  // Also close on swipe down
  let vpStartY=0;
  document.querySelector('.vp-sheet').addEventListener('touchstart',e=>{vpStartY=e.touches[0].clientY;},{passive:true});
  document.querySelector('.vp-sheet').addEventListener('touchend',e=>{if(e.changedTouches[0].clientY-vpStartY>80)closeVP();},{passive:true});
  document.getElementById('vp-inp-go').addEventListener('click',submitVPQuery);
  document.getElementById('vp-inp').addEventListener('keydown',e=>{if(e.key==='Enter')submitVPQuery();});
  document.getElementById('vp-inp-mic').addEventListener('click',toggleMic);
  document.getElementById('vp-stop').addEventListener('click',()=>{stopSpeak(); document.getElementById('vp-stop').style.display='none';});
  document.getElementById('vp-hints').querySelectorAll('.vp-hint').forEach(b=>{
    b.addEventListener('click',()=>{
      var txt = b.textContent.trim();
      document.getElementById('vp-inp').value = txt;
      // Directly map hints to categories for better results
      // Category hints
      var catMap = {
        'politics today':'politics','nigeria security':'politics',
        'crime news':'politics','news on judiciary':'politics',
        'business news':'business','economy today':'business',
        'sports headlines':'sports','super eagles':'sports',
        'celebrity news':'entertainment','health news':'health',
        'technology news':'technology',
      };
      // Source hints - filter by source name
      var srcMap = {
        'vanguard':'vanguard','punch':'punch','daily post':'daily post',
        'premium times':'premium times','guardian nigeria':'guardian nigeria',
        'channels tv':'channels tv','pulse nigeria':'pulse nigeria',
        'tribune':'tribune','legit.ng':'legit.ng','businessday':'businessday',
        'the nation':'the nation',
      };
      var key = txt.toLowerCase();
      if(catMap[key] !== undefined){
        var cat = catMap[key];
        var filtered = arts.filter(function(a){return a.cat===cat;});
        if(filtered.length){
          vpArts = filtered.slice(0,5);
          renderVPCards(vpArts);
          setStatus('✅ Found '+vpArts.length+' '+txt+' stories','ok');
          speakHeadlines(vpArts, null, cat, false);
        } else {
          setStatus('No '+txt+' stories right now. Pull to refresh!','err');
        }
      } else if(srcMap[key] !== undefined){
        var src = srcMap[key];
        var filtered2 = arts.filter(function(a){
          return a.source.toLowerCase().includes(src);
        });
        if(filtered2.length){
          vpArts = filtered2.slice(0,5);
          renderVPCards(vpArts);
          setStatus('✅ Found '+vpArts.length+' stories from '+txt,'ok');
          speakHeadlines(vpArts, src, null, false);
        } else {
          setStatus('No '+txt+' stories loaded yet. Try refreshing!','err');
        }
      } else {
        submitVPQuery();
      }
    });
  });
  if(synth&&synth.onvoiceschanged!==undefined) synth.onvoiceschanged=()=>synth.getVoices();
}
function openVP(){
  // Reset voice panel to clean state every time
  document.getElementById('vp-inp').value = '';
  document.getElementById('vp-results').style.display = 'none';
  document.getElementById('vp-stop').style.display = 'none';
  document.getElementById('vp-status').textContent = '';
  document.getElementById('vp-status').className = 'vp-status';
  vpArts = [];
  stopSpeak();
  document.getElementById('vp').classList.add('on');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>{ document.getElementById('vp-inp').focus(); }, 300);
}
function closeVP(){stopSpeak(); stopListen(); document.getElementById('vp').classList.remove('on'); document.body.style.overflow='';}
function submitVPQuery(){const q=document.getElementById('vp-inp').value.trim(); if(!q){setStatus('Type or speak a query first','err'); return;} processVPQuery(q);}
function toggleMic(){
  if(vpListening){stopListen(); return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus('Voice not supported — please type','err'); return;}
  stopSpeak(); recog=new SR(); recog.lang='en-US'; recog.continuous=false; recog.interimResults=true;
  vpListening=true; document.getElementById('vp-inp-mic').classList.add('on'); document.getElementById('vp-input-bar').classList.add('listening'); document.getElementById('voice-fab').classList.add('listening');
  if(navigator.vibrate) navigator.vibrate(20); setStatus('🎤 Listening…','');
  recog.onresult=e=>{const tx=Array.from(e.results).map(r=>r[0].transcript).join(''); document.getElementById('vp-inp').value=tx; if(e.results[e.results.length-1].isFinal){stopListen(); processVPQuery(tx);}};
  recog.onerror=e=>{stopListen(); if(e.error==='not-allowed') setStatus('🔒 Mic blocked','err'); else{setStatus('💡 Type your query and tap ➤',''); document.getElementById('vp-inp').focus();}};
  recog.onend=()=>stopListen();
  try{recog.start();}catch(e){stopListen(); setStatus('💡 Type your query and tap ➤',''); document.getElementById('vp-inp').focus();}
}
function stopListen(){vpListening=false; document.getElementById('vp-inp-mic').classList.remove('on'); document.getElementById('vp-input-bar').classList.remove('listening'); document.getElementById('voice-fab').classList.remove('listening'); if(recog){try{recog.stop();}catch(e){} recog=null;}}
async function processVPQuery(query){
  stopSpeak(); setStatus('⚡ Searching…',''); setGoLoading(true); document.getElementById('vp-results').style.display='none'; document.getElementById('vp-stop').style.display='none';
  const q=query.toLowerCase().trim();

  // Clean filler words from query
  const cleaned = q
    .replace(/(news|about|on|for|give me|show me|what's|what is|the|latest|breaking|today|please|in|of|regarding|concerning)/gi,'')
    .replace(/\s+/g,' ').trim();

  // Check source map first
  let srcQ=null; for(const[k,v]of Object.entries(SRC_MAP)){if(q.includes(k)){srcQ=v;break;}}

  // Check category/topic map (longest match first)
  let catQ=null;
  const sortedTopics = Object.entries(CAT_WORDS).sort((a,b)=>b[0].length-a[0].length);
  for(const[k,v]of sortedTopics){if(q.includes(k)){catQ=v;break;}}

  // Build search term
  let searchTerm=srcQ||'';
  if(!searchTerm){
    // Use cleaned query as search term for specific topics
    searchTerm = cleaned || query.replace(/give me|show me|what('s| is)|the|news|headlines|breaking|latest|today|please/gi,'').trim();
  }
  try{
    const p=new URLSearchParams(); if(searchTerm) p.set('q',searchTerm); if(catQ&&!srcQ) p.set('category',catQ);
    const r=await fetch(`${API}?${p}&_=${Date.now()}`, {cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const d=await r.json();
    if(d.status==='ok'&&d.articles?.length){let res=d.articles; if(srcQ){const f=res.filter(a=>a.source.toLowerCase().replace(/\s/g,'').includes(srcQ.replace(/\s/g,''))); if(f.length)res=f;} vpArts=res.slice(0,5); renderVPCards(vpArts); setStatus('✅ Found '+vpArts.length+' stories','ok'); speakHeadlines(vpArts,srcQ,catQ,q.includes('break'));}
    else setStatus('No results. Try different keywords.','err');
  }catch(e){setStatus('Error: '+e.message,'err');}
  setGoLoading(false);
}
function renderVPCards(results){const box=document.getElementById('vp-results'); box.style.display='flex'; box.innerHTML=results.map((a,i)=>`<div class="vpc"><div class="vpc-num">${i+1}</div><div class="vpc-body"><div class="vpc-src">${a.source} · ${ago(a.pub)}</div><div class="vpc-hl">${getTitle(a)}</div></div><div class="vpc-play"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>`).join(''); box.querySelectorAll('.vpc').forEach((el,i)=>{el.addEventListener('click',()=>{stopSpeak(); setTimeout(()=>{closeVP(); openArt(vpArts[i]);},200);});});}
function speakHeadlines(results,srcQ,catQ,isBreaking){
  const src=srcQ?srcQ.replace('saharareporters','Sahara Reporters').replace('premiumtimes','Premium Times').replace('dailytrust','Daily Trust'):'';
  const lang = pidginOn ? 'Pidgin' : (catQ||'');
  const intro = pidginOn
    ? `Here na ${results.length} ${isBreaking?'breaking ':''}${src?src+' ':''}headlines for you. `
    : `Here are ${isBreaking?'the breaking ':''}${catQ||''} headlines${src?' from '+src:''}. ${results.length} stories. `;
  const stories = results.map((a,i)=>`Story ${i+1}: ${getTitle(a)}.`).join(' ');
  const outro = pidginOn ? ' Tap any story to read am.' : ' Tap any story to read more.';
  speak(intro + stories + outro);
}
function speak(text){stopSpeak(); if(!synth)return; const u=new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate=0.92; u.pitch=1; u.volume=1; const voices=synth.getVoices(); const best=voices.find(v=>v.name.includes('Google UK English Female')||v.name.includes('Samantha')||(v.lang==='en-GB'&&v.localService)); if(best)u.voice=best; u.onstart=()=>{document.getElementById('voice-fab').classList.add('speaking'); document.getElementById('vp-stop').style.display='block';}; u.onend=()=>{document.getElementById('voice-fab').classList.remove('speaking');}; u.onerror=()=>{document.getElementById('voice-fab').classList.remove('speaking');}; synth.speak(u);}
function stopSpeak(){if(synth)synth.cancel(); document.getElementById('voice-fab').classList.remove('speaking');}
function setStatus(msg,type){const el=document.getElementById('vp-status'); el.textContent=msg; el.className='vp-status'+(type?' '+type:'');}
function setGoLoading(on){document.getElementById('vp-inp-go').classList.toggle('loading',on);}

async function shareAsImage(a){
  toast('🖼️ Generating image card…');
  const canvas=document.getElementById('share-canvas');
  const ctx=canvas.getContext('2d');
  const W=1080,H=1080;
  canvas.width=W; canvas.height=H;
  ctx.fillStyle='#0f0f0f'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#00C853'; ctx.fillRect(0,0,W,8);
  if(a.img){
    await new Promise(resolve=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>{ctx.globalAlpha=0.25; ctx.drawImage(img,0,0,W,H); ctx.globalAlpha=1; resolve();};
      img.onerror=resolve; img.src=a.img; setTimeout(resolve,3000);
    });
  }
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#00C853'; ctx.fillRect(0,0,W,8);
  // bolt
  ctx.fillStyle='#00C853'; ctx.beginPath();
  const bx=80,by=80,bs=70;
  ctx.moveTo(bx+bs*.6,by); ctx.lineTo(bx+bs*.28,by+bs*.46); ctx.lineTo(bx+bs*.54,by+bs*.46);
  ctx.lineTo(bx+bs*.38,by+bs); ctx.lineTo(bx+bs*.72,by+bs*.54); ctx.lineTo(bx+bs*.46,by+bs*.54);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 52px sans-serif'; ctx.fillText('FLASH',165,130);
  ctx.fillStyle='#00C853'; ctx.fillText(' NIGERIA',318,130);
  if(a.cat){ctx.fillStyle='#00C853'; ctx.beginPath(); ctx.roundRect(80,180,130,36,8); ctx.fill(); ctx.fillStyle='#000'; ctx.font='bold 20px sans-serif'; ctx.textAlign='center'; ctx.fillText(a.cat.toUpperCase(),145,204); ctx.textAlign='left';}
  ctx.fillStyle='#fff'; ctx.font='bold 66px sans-serif';
  const title=pidginOn?toPidgin(a.title):a.title;
  const words=title.split(' '); let line=''; let ly=310;
  for(const w of words){const test=line+w+' '; if(ctx.measureText(test).width>W-160&&line!==''){ctx.fillText(line,80,ly); line=w+' '; ly+=80; if(ly>700){ctx.fillText('…',80,ly); break;}}else line=test;}
  ctx.fillText(line,80,ly);
  ctx.fillStyle='#888'; ctx.font='36px sans-serif'; ctx.fillText(`${a.source}  ·  ${ago(a.pub)}`,80,H-120);
  ctx.fillStyle='#00C853'; ctx.font='30px sans-serif'; ctx.fillText('www.flashnigeria.com',80,H-70);
  ctx.fillStyle='#00C853'; ctx.fillRect(0,H-8,W,8);
  try{
    canvas.toBlob(async blob=>{
      if(!blob) return;
      const file=new File([blob],'flash-nigeria-news.png',{type:'image/png'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'Flash Nigeria',text:title,files:[file]});
      } else {
        const url=URL.createObjectURL(blob);
        const a2=document.createElement('a'); a2.href=url; a2.download='flash-nigeria-news.png'; a2.click();
        URL.revokeObjectURL(url); toast('🖼️ Image saved — share to Instagram/WhatsApp!');
      }
    },'image/png');
  }catch(e){toast('Image ready — long press to save');}
}



// ── POLL TOGGLE ──
function togglePoll(){
  const body=document.getElementById('poll-body');
  const toggle=document.getElementById('poll-toggle');
  if(!body||!toggle) return;
  const collapsed=body.style.display==='none';
  body.style.display=collapsed?'block':'none';
  toggle.classList.toggle('collapsed',!collapsed);
}

// ── BACK TO TOP + SCROLL PROGRESS ──
(function(){
  const main=document.getElementById('main');
  const btt=document.getElementById('btt');
  const bar=document.getElementById('scroll-bar');
  main.addEventListener('scroll',()=>{
    const st=main.scrollTop;
    const sh=main.scrollHeight-main.clientHeight;
    // Progress bar
    bar.style.width=(sh>0?Math.min(100,st/sh*100):0)+'%';
    // BTT button
    btt.classList.toggle('show',st>400);
  },{passive:true});
  btt.addEventListener('click',()=>{
    main.scrollTo({top:0,behavior:'smooth'});
    if(navigator.vibrate) navigator.vibrate(10);
  });
})();


// ── FONT SIZE TOGGLE ──
(function(){
  const FONT_K='fn_font';
  const sizes=['','text-lg'];
  let idx=parseInt(localStorage.getItem(FONT_K)||'0');
  document.body.classList.toggle('text-lg', idx===1);
  document.getElementById('font-btn').addEventListener('click',()=>{
    document.body.classList.remove(...sizes.filter(Boolean));
    idx=(idx+1)%sizes.length;
    if(sizes[idx]) document.body.classList.add(sizes[idx]);
    localStorage.setItem(FONT_K,idx);
    toast(idx===1?'🔤 Larger text':'🔤 Normal text');
  });
})();

// ── MODAL READING PROGRESS ──
(function(){
  document.getElementById('mo-body').addEventListener('scroll',function(){
    const el=this;
    const pct=el.scrollHeight-el.clientHeight>0
      ? Math.min(100, el.scrollTop/(el.scrollHeight-el.clientHeight)*100) : 100;
    document.getElementById('modal-progress').style.width=pct+'%';
  },{passive:true});
})();

// ── RELATED STORIES ──
function renderRelated(currentArt){
  const related = arts
    .filter(a => a.id !== currentArt.id && (
      a.cat === currentArt.cat || a.source === currentArt.source
    ))
    .slice(0, 3);
  if(!related.length) return '';
  related.forEach(a => { window._rel = window._rel||{}; window._rel[a.id]=a; });
  let out = '<div class="related-wrap"><div class="related-hd"><em>📰</em>Related Stories</div>';
  related.forEach(function(a){
    out += '<div class="related-card" data-rid="' + a.id + '">';
    if(a.img){
      out += '<img class="related-thumb" src="' + a.img + '" alt="" loading="lazy">';
    } else {
      out += '<div class="related-thumb-ph">' + catEmoji(a.cat) + '</div>';
    }
    out += '<div class="related-body">';
    out += '<div class="related-src">' + a.source + ' · ' + ago(a.pub) + '</div>';
    out += '<div class="related-hl">' + getTitle(a) + '</div>';
    out += '</div></div>';
  });
  out += '</div>';
  return out;
}





// ── INFINITE SCROLL — conservative to save API calls ──


// Infinite scroll + Load More button — single source of truth
(function(){
  // ── LOAD MORE BUTTON ── bound once, never rebound
  var lmBtn = document.getElementById('load-more');
  if(lmBtn){
    lmBtn.addEventListener('click', function(){
      if(busy || !nextPg) return;
      lmBtn.textContent = 'Loading...';
      lmBtn.disabled = true;
      loadNews(true).finally(function(){
        lmBtn.disabled = false;
      });
    });
  }
  // ── INFINITE SCROLL ──
  var scrollEl = document.getElementById('main');
  var scrollLast = 0;
  scrollEl.addEventListener('scroll', function(){
    if(busy || !nextPg) return;
    var now = Date.now();
    if(now - scrollLast < 2000) return;
    var scrolled = scrollEl.scrollTop + scrollEl.clientHeight;
    var total = scrollEl.scrollHeight;
    if(scrolled >= total - 500){
      scrollLast = now;
      loadNews(true).then(function(){

      }).catch(function(){

      });
    }
  }, {passive:true});
})();

// -- NOTIFICATION SYSTEM --
function quickToggleNotif(){
  if(Notification.permission==='denied'){
    toast('Blocked! Go to phone Settings > Browser > Notifications > Enable Flash Nigeria');
    return;
  }
  if(Notification.permission!=='granted'){
    Notification.requestPermission().then(function(p){
      if(p==='granted'){
        localStorage.removeItem('fn_notif_off');
        updateNotifHdrBtn();
        toast('Breaking alerts ON!');
        if(navigator.serviceWorker&&navigator.serviceWorker.controller){
          navigator.serviceWorker.controller.postMessage({type:'TEST_NOTIF'});
        }
      } else {
        toast('Notifications blocked');
        updateNotifHdrBtn();
      }
    });
    return;
  }
  var isOn = localStorage.getItem('fn_notif_off')!=='1';
  if(isOn){
    localStorage.setItem('fn_notif_off','1');
    toast('Breaking alerts OFF');
  } else {
    localStorage.removeItem('fn_notif_off');
    toast('Breaking alerts ON!');
  }
  updateNotifHdrBtn();
  updateNotifUI();
}

function updateNotifHdrBtn(){
  var btn=document.getElementById('notif-hdr-btn');
  var txt=document.getElementById('notif-hdr-txt');
  var ico=document.getElementById('notif-hdr-ico');
  if(!btn) return;
  var isOff=localStorage.getItem('fn_notif_off')==='1';
  var isGranted=Notification.permission==='granted';
  if(isGranted&&!isOff){
    btn.style.background='var(--gold)';
    btn.style.borderColor='var(--gold)';
    if(ico) ico.textContent='🔔';
    if(txt){ txt.textContent='ON'; txt.style.display='block'; }
  } else {
    btn.style.background='var(--bg)';
    btn.style.borderColor='var(--border2)';
    if(ico) ico.textContent='🔕';
    if(txt){ txt.style.display='none'; }
  }
}

function updateNotifUI(){
  var btn=document.getElementById('notif-toggle-btn');
  var dot=document.getElementById('notif-toggle-dot');
  var txt=document.getElementById('notif-status-text');
  if(!btn||!txt) return;
  var isOff=localStorage.getItem('fn_notif_off')==='1';
  if(Notification.permission==='granted'&&!isOff){
    btn.style.background='var(--gold)';
    if(dot) dot.style.left='22px';
    txt.textContent='Breaking alerts are ON. Max 3 per day.';
  } else if(Notification.permission==='granted'&&isOff){
    btn.style.background='var(--border2)';
    if(dot) dot.style.left='3px';
    txt.textContent='Alerts paused. Tap bell to resume.';
  } else if(Notification.permission==='denied'){
    btn.style.background='var(--border2)';
    if(dot) dot.style.left='3px';
    txt.textContent='Blocked in browser. Go to Settings to enable.';
  } else {
    btn.style.background='var(--border2)';
    if(dot) dot.style.left='3px';
    txt.textContent='Tap bell icon to enable breaking news alerts';
  }
}

function toggleNotifications(){
  quickToggleNotif();
}


// ── FLASH NIGERIA SUPABASE AUTH / SAVED ARTICLES ──
const FLASH_SUPABASE_URL="https://asayqggcbtonwzwcfjya.supabase.co";
const FLASH_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzYXlxZ2djYnRvbnd6d2NmanlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDgzNDAsImV4cCI6MjA5ODIyNDM0MH0.DXcl2jLw3cpy_uJx3lvS4xOAxkVLlrrQmwbjPrkwZco";
let flashSB=null, flashUser=null, authMode='login';
function initFlashAuth(){try{if(!window.supabase)return;flashSB=window.supabase.createClient(FLASH_SUPABASE_URL,FLASH_SUPABASE_ANON_KEY);flashSB.auth.getSession().then(({data})=>{flashUser=data&&data.session?data.session.user:null;updateAuthUI();if(flashUser){loadCloudSaved();loadFlashPersonalization();cleanAuthUrl('✅ Welcome back');}else{cleanExpiredAuthUrl();}});flashSB.auth.onAuthStateChange((event,session)=>{flashUser=session?session.user:null;updateAuthUI();if(flashUser){loadCloudSaved();loadFlashPersonalization();if(event==='SIGNED_IN')cleanAuthUrl('✅ Welcome back');}else{saved=JSON.parse(localStorage.getItem(SAVED_K)||'[]');renderSaved();}});}catch(e){console.warn('Auth init error',e);}}
function cleanAuthUrl(msg){if(location.hash&&(/access_token|refresh_token|type=signup|error/.test(location.hash))){history.replaceState({},document.title,location.pathname);if(msg)toast(msg);}}
function cleanExpiredAuthUrl(){if(location.hash&&/otp_expired|access_denied|error=/.test(location.hash)){toast('Email link expired. Please sign up or login again.');history.replaceState({},document.title,location.pathname);}}
function openAuthModal(mode){setAuthMode(mode||'login');document.getElementById('auth-modal').classList.add('on');}
function closeAuthModal(){document.getElementById('auth-modal').classList.remove('on');}
function setAuthMode(mode){authMode=mode==='signup'?'signup':'login';document.getElementById('auth-login-tab').classList.toggle('on',authMode==='login');document.getElementById('auth-signup-tab').classList.toggle('on',authMode==='signup');document.getElementById('auth-name-wrap').style.display=authMode==='signup'?'block':'none';document.getElementById('auth-submit-btn').textContent=authMode==='signup'?'Create Account':'Login';document.getElementById('auth-message').textContent=authMode==='signup'?'Create a free Flash Nigeria account. You may need to confirm your email.':'Login to sync your saved stories across devices.';}
async function submitAuth(){if(!flashSB){toast('Auth not ready. Refresh and try again.');return;}const email=document.getElementById('auth-email').value.trim();const password=document.getElementById('auth-password').value;const fullName=document.getElementById('auth-name').value.trim();const msg=document.getElementById('auth-message');if(!email||!password){msg.textContent='Enter email and password.';return;}msg.textContent='Please wait...';try{let res;if(authMode==='signup'){res=await flashSB.auth.signUp({email,password,options:{data:{full_name:fullName}}});if(res.error)throw res.error;msg.textContent='Account created. Check your email if confirmation is required.';toast('✅ Flash account created');}else{res=await flashSB.auth.signInWithPassword({email,password});if(res.error)throw res.error;msg.textContent='Logged in successfully.';toast('✅ Logged in');closeAuthModal();}}catch(e){msg.textContent=e.message||'Authentication failed.';toast('⚠️ '+msg.textContent);}}
async function logoutFlash(){if(!flashSB)return;await flashSB.auth.signOut();toast('Logged out');updateAuthUI();}
function updateAuthUI(){const btn=document.getElementById('auth-open-btn');const logged=!!flashUser;if(btn){btn.textContent=logged?'Account':'Login';btn.onclick=logged?function(){switchView('profile')}:function(){openAuthModal('login')}}const out=document.getElementById('profile-logged-out'),inn=document.getElementById('profile-logged-in');if(out&&inn){out.style.display=logged?'none':'block';inn.style.display=logged?'block':'none';}const emailEl=document.getElementById('profile-email');if(emailEl)emailEl.textContent=logged?flashUser.email:'—';const planEl=document.getElementById('profile-plan');if(planEl)planEl.textContent=logged?'Free — PRO ready':'Free';const av=document.getElementById('profile-avatar');if(av){const seed=logged?(flashUser.user_metadata?.full_name||flashUser.email||'F'):'⚡';av.textContent=logged?seed.trim().charAt(0).toUpperCase():'⚡';}const ver=document.getElementById('profile-verified');if(ver&&logged){ver.textContent=flashUser.email_confirmed_at?'● Email verified':'○ Email not verified yet';ver.style.color=flashUser.email_confirmed_at?'var(--green)':'var(--red)';}updateProfileSavedCount();}
function updateProfileSavedCount(){const el=document.getElementById('profile-saved-count');if(el)el.textContent=String(saved.length||0);const d=document.getElementById('dash-saved-count');if(d)d.textContent=String(saved.length||0);}
async function loadCloudSaved(){if(!flashSB||!flashUser)return;try{const {data,error}=await flashSB.from('saved_articles').select('*').eq('user_id',flashUser.id).order('created_at',{ascending:false});if(error)throw error;saved=(data||[]).map(row=>({id:row.article_id,title:row.title,source:row.source,link:row.link,img:row.image_url,cat:row.category,pub:row.published_at}));localStorage.setItem(SAVED_K,JSON.stringify(saved));renderSaved();updateBadge();updateProfileSavedCount();}catch(e){console.warn('Cloud saved load error',e);}}
async function saveCloudArticle(a){if(!flashSB||!flashUser||!a)return;try{await flashSB.from('saved_articles').upsert({user_id:flashUser.id,article_id:String(a.id),title:a.title||'',source:a.source||'',link:a.link||'',image_url:a.img||'',category:a.cat||'',published_at:a.pub||null},{onConflict:'user_id,article_id'});}catch(e){console.warn('Cloud save error',e);}}
async function removeCloudArticle(a){if(!flashSB||!flashUser||!a)return;try{await flashSB.from('saved_articles').delete().eq('user_id',flashUser.id).eq('article_id',String(a.id));}catch(e){console.warn('Cloud remove error',e);}}
async function clearCloudSaved(){if(!flashSB||!flashUser)return;try{await flashSB.from('saved_articles').delete().eq('user_id',flashUser.id);}catch(e){console.warn('Cloud clear error',e);}}
const _oldToggleSave=toggleSave;toggleSave=function(a,btn){const wasSaved=saved.some(s=>s.id===a.id);_oldToggleSave(a,btn);if(flashUser){if(wasSaved)removeCloudArticle(a);else saveCloudArticle(a);}else{toast('📌 Saved on this device. Login to sync.');}updateProfileSavedCount();};
const _oldRenderSaved=renderSaved;renderSaved=function(){_oldRenderSaved();updateProfileSavedCount();};

let lastTrackedCompany='';
function trackerTitleText(a){return String(a && a.title ? a.title : '').toLowerCase();}
function trackerMatches(a,q){
  const term=(q||'').trim().toLowerCase();
  if(!term) return false;
  const title=trackerTitleText(a);
  // Strict headline-only matching. This prevents unrelated headlines from showing
  // just because the API returned them or a hidden description contained a word.
  if(term.includes(' ')) return title.includes(term);
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^a-z0-9])'+escaped+'([^a-z0-9]|$)','i').test(title);
}
function quickTrack(term){
  const inp=document.getElementById('company-track-input');
  if(inp) inp.value=term;
  runCompanyTracker();
}
async function runCompanyTracker(){
  const inp=document.getElementById('company-track-input');
  const box=document.getElementById('company-track-results');
  if(!inp||!box)return;
  const q=inp.value.trim();
  if(!q){box.innerHTML='<div class="mini-note">Enter a company, politician, or keyword first.</div>';return;}
  lastTrackedCompany=q;
  box.innerHTML='<div class="mini-note">Searching exact headline mentions only…</div>';

  // First search the loaded headlines strictly.
  let results=(arts||[]).filter(a=>trackerMatches(a,q));

  // Then ask the live API, but still strictly filter the returned stories.
  if(results.length<3){
    try{
      const r=await fetch(`${API}?q=${encodeURIComponent(q)}&_=${Date.now()}`,{cache:'no-store'});
      const d=await r.json();
      if(d.status==='ok'&&d.articles){
        const live=(d.articles||[]).filter(a=>trackerMatches(a,q));
        const seen=new Set(results.map(a=>String(a.id||a.link||a.title)));
        live.forEach(a=>{const k=String(a.id||a.link||a.title);if(!seen.has(k)){seen.add(k);results.push(a);}});
      }
    }catch(e){}
  }

  results=results.slice(0,8);
  if(!results.length){
    box.innerHTML=`<div class="mini-note">No exact headline mention found for <strong>${q}</strong> right now. Try another company, public figure, celebrity, or topic.</div>`;
    return;
  }
  const srcs=[...new Set(results.map(a=>a.source||'Flash Nigeria'))];
  box.innerHTML=`<div class="tracker-stats"><div class="tracker-stat"><b>${results.length}</b><span>Exact Mentions</span></div><div class="tracker-stat"><b>${srcs.length}</b><span>Sources</span></div><div class="tracker-stat"><b>${results.filter(isTrending).length}</b><span>Trending</span></div></div><div class="mini-note"><strong>${results.length}</strong> exact current mention${results.length===1?'':'s'} found for <strong>${q}</strong>.</div>`+results.map((a,i)=>`<div class="tracker-result" data-i="${i}"><div class="tracker-src">${a.source||'Flash Nigeria'} · ${ago(a.pub)}</div><div class="tracker-title">${getTitle(a)}</div></div>`).join('');
  box.querySelectorAll('.tracker-result').forEach((el,i)=>el.addEventListener('click',()=>openArt(results[i])));
}
async function followTrackedCompany(){
  const q=(lastTrackedCompany||(document.getElementById('company-track-input')?.value||'')).trim();
  if(!q){toast('Enter a company first');return;}
  if(!flashUser){toast('Login to follow companies');openAuthModal('login');return;}
  try{await flashSB.from('followed_companies').upsert({user_id:flashUser.id,company_name:q},{onConflict:'user_id,company_name'});if(!flashFollowedCompanies.includes(q))flashFollowedCompanies.unshift(q);toast('⭐ Following '+q);addLocalNotification('Company followed','You are now monitoring '+q+'.');renderFlashDashboard();}catch(e){toast('Could not follow yet');console.warn(e);}
}


// ── FLASH NIGERIA PRO V4: account, saved, follows, alerts, dashboard ──
let flashFollowedCompanies=[], flashFollowedTopics=[], flashNotifications=[];
function requestProAccess(){
  if(!flashUser){toast('Login to request PRO access');openAuthModal('login');return;}
  toast('♛ PRO access request received');
  addLocalNotification('PRO Access','Your account is marked for early PRO access review.');
}
async function loadFlashPersonalization(){
  if(!flashSB||!flashUser)return;
  try{
    const [companies,topics,notes]=await Promise.all([
      flashSB.from('followed_companies').select('*').eq('user_id',flashUser.id).order('created_at',{ascending:false}),
      flashSB.from('followed_topics').select('*').eq('user_id',flashUser.id).order('created_at',{ascending:false}),
      flashSB.from('notifications').select('*').eq('user_id',flashUser.id).order('created_at',{ascending:false}).limit(10)
    ]);
    flashFollowedCompanies=(companies.data||[]).map(x=>x.company_name);
    flashFollowedTopics=(topics.data||[]).map(x=>x.topic);
    flashNotifications=(notes.data||[]);
    renderFlashDashboard();
  }catch(e){console.warn('Personalization load error',e);renderFlashDashboard();}
}
function renderFlashDashboard(){
  const savedCt=document.getElementById('dash-saved-count'); if(savedCt)savedCt.textContent=String(saved.length||0);
  const fCt=document.getElementById('dash-follow-count'); if(fCt)fCt.textContent=String((flashFollowedCompanies.length||0)+(flashFollowedTopics.length||0));
  const aCt=document.getElementById('dash-alert-count'); if(aCt)aCt.textContent=String(flashNotifications.length||0);
  document.querySelectorAll('.follow-chip').forEach(btn=>btn.classList.toggle('on',flashFollowedTopics.includes(btn.dataset.topic)));
  if(typeof renderMyFeed==='function') renderMyFeed();
  const list=document.getElementById('flash-notification-list');
  if(list){
    const local = flashNotifications.length ? flashNotifications : buildSmartAlerts();
    list.innerHTML = local.length ? local.slice(0,6).map(n=>`<div class="notif-item"><strong>${n.title||'Flash Alert'}</strong>${n.message||''}</div>`).join('') : '<div class="mini-note">No personal alerts yet. Follow topics or companies to begin.</div>';
  }
}
function buildSmartAlerts(){
  const alerts=[];
  const follows=[...flashFollowedCompanies,...flashFollowedTopics];
  follows.forEach(f=>{
    const found=(arts||[]).filter(a=>((a.title||'')+' '+(a.desc||'')+' '+(a.cat||'')).toLowerCase().includes(String(f).toLowerCase())).slice(0,1);
    if(found.length) alerts.push({title:'New mention: '+f,message:getTitle(found[0])});
  });
  return alerts;
}
function addLocalNotification(title,message){
  flashNotifications.unshift({title,message,created_at:new Date().toISOString()});
  renderFlashDashboard();
}
async function toggleTopicFollow(topic){
  if(!flashUser){toast('Login to follow topics');openAuthModal('login');return;}
  try{
    if(flashFollowedTopics.includes(topic)){
      await flashSB.from('followed_topics').delete().eq('user_id',flashUser.id).eq('topic',topic);
      flashFollowedTopics=flashFollowedTopics.filter(x=>x!==topic);toast('Removed '+topic);
    }else{
      await flashSB.from('followed_topics').upsert({user_id:flashUser.id,topic},{onConflict:'user_id,topic'});
      flashFollowedTopics.unshift(topic);toast('⭐ Following '+topic);
      addLocalNotification('Topic followed', 'You are now following '+topic+'.');
    }
    renderFlashDashboard();
  }catch(e){toast('Could not update topic');console.warn(e);}
}

// Avoid needing a database unique constraint for saved_articles.
saveCloudArticle = async function(a){
  if(!flashSB||!flashUser||!a)return;
  try{
    const payload={
      user_id:flashUser.id,
      article_id:String(a.id),
      title:a.title||'',
      source:a.source||'',
      link:a.link||'',
      image_url:a.img||'',
      category:a.cat||'',
      published_at:a.pub||null
    };
    const existing=await flashSB.from('saved_articles')
      .select('id')
      .eq('user_id',flashUser.id)
      .eq('article_id',String(a.id))
      .limit(1);
    if(existing.error) throw existing.error;
    if(existing.data && existing.data.length){
      await flashSB.from('saved_articles').update(payload).eq('id',existing.data[0].id);
    }else{
      await flashSB.from('saved_articles').insert(payload);
    }
  }catch(e){console.warn('Cloud save error',e);toast('Saved locally. Cloud sync will retry later.');}
};

// Keep Supabase saved count clean after Clear All.
document.addEventListener('DOMContentLoaded',function(){
  var clearBtn=document.getElementById('sv-clr');
  if(clearBtn){
    clearBtn.addEventListener('click',function(){
      if(flashUser) clearCloudSaved();
      updateProfileSavedCount();
    });
  }
});

// Add Enter key support for company tracker.
document.addEventListener('DOMContentLoaded',function(){
  var ci=document.getElementById('company-track-input');
  if(ci){ci.addEventListener('keydown',function(e){if(e.key==='Enter')runCompanyTracker();});}
});


// ── FLASH NIGERIA MY FEED V6 ──
function mfUserName(){
  if(!flashUser) return 'Guest';
  const n=(flashUser.user_metadata&&flashUser.user_metadata.full_name)||'';
  if(n.trim()) return n.trim().split(' ')[0];
  return (flashUser.email||'User').split('@')[0];
}
function mfFollowList(){
  return [...(flashFollowedTopics||[]), ...(flashFollowedCompanies||[])].filter(Boolean);
}
function mfMatchesArticle(a,follow){
  const hay=((a.title||'')+' '+(a.desc||'')+' '+(a.cat||'')+' '+(a.source||'')).toLowerCase();
  return hay.includes(String(follow).toLowerCase());
}
function mfArticleHTML(a,ico){
  return `<div class="mf-item" data-id="${a.id}"><div class="mf-ico">${ico||catEmoji(a.cat)}</div><div style="flex:1;min-width:0"><div class="mf-meta">${a.source||'Flash Nigeria'} · ${ago(a.pub)}${a.cat?' · '+a.cat:''}</div><div class="mf-headline">${getTitle(a)}</div></div></div>`;
}
function bindMfArticles(root,items){
  if(!root) return;
  root.querySelectorAll('.mf-item[data-id]').forEach(el=>{
    el.addEventListener('click',()=>{
      const art=items.find(a=>String(a.id)===String(el.dataset.id));
      if(art) openArt(art);
    });
  });
}
function renderMyFeed(){
  const greeting=document.getElementById('mf-greeting');
  if(!greeting) return;
  const name=mfUserName();
  greeting.textContent=flashUser?`Welcome back, ${name} 👋`:'My Feed';
  const savedCt=document.getElementById('mf-saved-count'); if(savedCt) savedCt.textContent=String(saved.length||0);
  const follows=mfFollowList();
  const fCt=document.getElementById('mf-follow-count'); if(fCt) fCt.textContent=String(follows.length||0);
  const alerts=buildSmartAlerts();
  const aCt=document.getElementById('mf-alert-count'); if(aCt) aCt.textContent=String((flashNotifications||[]).length||alerts.length||0);

  const chips=document.getElementById('mf-interest-chips');
  if(chips){
    if(follows.length){
      chips.innerHTML=follows.map(x=>`<span class="mf-chip on">${x}</span>`).join('');
    }else{
      chips.innerHTML='<div class="mf-empty">Follow topics or companies from your Profile to personalize this page.</div>';
    }
  }

  const personalBox=document.getElementById('mf-personal-list');
  let personal=[];
  if(follows.length){
    const seen=new Set();
    follows.forEach(f=>{
      (arts||[]).filter(a=>mfMatchesArticle(a,f)).forEach(a=>{ if(!seen.has(a.id)){seen.add(a.id); personal.push(a);} });
    });
  }
  personal=personal.slice(0,8);
  if(personalBox){
    personalBox.innerHTML=personal.length?personal.map(a=>mfArticleHTML(a,'⭐')).join(''):'<div class="mf-empty">No matched headlines yet. Follow more topics or refresh the news feed.</div>';
    bindMfArticles(personalBox,personal);
  }

  const savedBox=document.getElementById('mf-saved-list');
  const savedItems=(saved||[]).slice(0,4);
  if(savedBox){
    savedBox.innerHTML=savedItems.length?savedItems.map(a=>mfArticleHTML(a,'📚')).join(''):'<div class="mf-empty">Save articles to build your personal reading library.</div>';
    bindMfArticles(savedBox,savedItems);
  }

  const alertBox=document.getElementById('mf-alert-list');
  const combinedAlerts=(flashNotifications&&flashNotifications.length?flashNotifications:alerts).slice(0,5);
  if(alertBox){
    alertBox.innerHTML=combinedAlerts.length?combinedAlerts.map(n=>`<div class="mf-item"><div class="mf-ico">🔔</div><div style="flex:1"><div class="mf-meta">Personal alert</div><div class="mf-headline">${n.title||'Flash Alert'}</div><div class="mini-note">${n.message||''}</div></div></div>`).join(''):'<div class="mf-empty">You are all caught up. Follow companies or topics to receive personal alerts.</div>';
  }

  const trendBox=document.getElementById('mf-trending-list');
  let trending=[...(arts||[])].sort((a,b)=>(trendScore(b)-trendScore(a)) || (new Date(b.pub)-new Date(a.pub))).slice(0,6);
  if(trendBox){
    trendBox.innerHTML=trending.length?trending.map(a=>mfArticleHTML(a,'🔥')).join(''):'<div class="mf-empty">Trending stories will appear here after news loads.</div>';
    bindMfArticles(trendBox,trending);
  }
}

// Keep My Feed fresh after news, saved articles, and login changes.
(function(){
  const oldRenderFeed=renderFeed;
  renderFeed=function(){ oldRenderFeed(); if(typeof renderMyFeed==='function') renderMyFeed(); };
  const oldUpdateAuthUI=updateAuthUI;
  updateAuthUI=function(){ oldUpdateAuthUI(); if(typeof renderMyFeed==='function') renderMyFeed(); };
})();