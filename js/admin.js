/* Admin dashboard: Firebase Auth login + live view of Firestore "appointments".
   Real protection is in firestore.rules (only ADMIN_EMAIL can read all / edit / delete). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ADMIN_EMAIL = 'admin@gmail.com';
const STATUSES = {
  pending:   {label:'Pending',   color:'#fab219', icon:'…'},
  confirmed: {label:'Confirmed', color:'#0ca30c', icon:'✓'},
  completed: {label:'Completed', color:'#3987e5', icon:'★'},
  cancelled: {label:'Cancelled', color:'#d03b3b', icon:'✕'}
};

const app = initializeApp({
  apiKey: "AIzaSyA-Po8Edgg5uTlq4MUosj94OBcSjUB_Das",
  authDomain: "bai-hotel-cebu.firebaseapp.com",
  projectId: "bai-hotel-cebu",
  storageBucket: "bai-hotel-cebu.firebasestorage.app",
  messagingSenderId: "770474829422",
  appId: "1:770474829422:web:a1ed04cb171fc65bb5687f"
});
const auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
let all = [], unsub = null, firstSnap = true, range = 'past', openId = null;

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stOf = a => STATUSES[a.status] ? a.status : 'pending';
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayStr = () => ymd(new Date());
const fmtTime = t => { const [h,m] = (t||'0:0').split(':').map(Number); return ((h%12)||12)+':'+pad(m)+' '+(h>=12?'PM':'AM'); };
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : '';
const bookedAt = a => a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}) : '';
const live = a => stOf(a) !== 'cancelled';
const mk = (tag, attrs={}, parent) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };

let toastT;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3500); }

function friendly(e){
  const c = e && e.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Wrong email or password.';
  if (c==='auth/too-many-requests') return 'Too many attempts. Try again later.';
  if (c==='auth/network-request-failed') return 'Network error. Check your connection.';
  if (c==='auth/requires-recent-login') return 'For security, sign out, sign in again, then retry.';
  if (c==='auth/weak-password') return 'Password is too weak.';
  if (c==='permission-denied') return 'Permission denied. Publish the latest firestore.rules in Firebase.';
  return (e && e.message) || 'Something went wrong.';
}
const setMsg = (id, text, ok) => { const m=$(id); m.textContent=text||''; m.className='msg'+(ok?' info':''); };

/* ---------- auth ---------- */
$('loginForm').addEventListener('submit', async ev => {
  ev.preventDefault(); setMsg('loginMsg','');
  const email = $('aEmail').value.trim(), pass = $('aPass').value;
  if (!email || !pass){ setMsg('loginMsg','Enter email and password.'); return; }
  $('loginBtn').disabled = true;
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch(e){ setMsg('loginMsg', friendly(e)); }
  $('loginBtn').disabled = false;
});
$('logoutBtn').onclick = () => signOut(auth);

onAuthStateChanged(auth, u => {
  const isAdmin = !!u && (u.email||'').toLowerCase() === ADMIN_EMAIL;
  if (u && !isAdmin){ signOut(auth); setMsg('loginMsg','This account is not an admin.'); return; }
  $('loginView').hidden = isAdmin;
  $('dashView').hidden = !isAdmin;
  if (isAdmin){ $('who').textContent = u.email; $('aPass').value=''; startLive(); }
  else { stopLive(); all = []; }
});

/* ---------- live data ---------- */
function startLive(){
  stopLive(); firstSnap = true;
  setMsg('dashMsg','');
  unsub = onSnapshot(query(collection(db,'appointments'), orderBy('createdAt','desc')), snap => {
    if (!firstSnap){
      const added = snap.docChanges().filter(c => c.type==='added' && !c.doc.metadata.hasPendingWrites);
      if (added.length) toast(added.length===1 ? 'New appointment: '+(added[0].doc.data().fullName||'') : added.length+' new appointments');
    }
    firstSnap = false;
    all = snap.docs.map(d => ({id:d.id, ...d.data()}));
    $('live').className = 'live on'; $('liveTxt').textContent = 'Live · updates automatically';
    refreshServiceFilter(); renderAll();
    if (openId) { const a = all.find(x=>x.id===openId); if (a) fillDetail(a, true); else closeModals(); }
  }, err => {
    $('live').className = 'live'; $('liveTxt').textContent = 'Not connected';
    setMsg('dashMsg', friendly(err)); console.error(err);
  });
}
function stopLive(){ if (unsub){ unsub(); unsub = null; } }

function refreshServiceFilter(){
  const sel = $('fService'), cur = sel.value;
  sel.innerHTML = '<option value="">All services</option>' +
    [...new Set(all.map(a=>a.service).filter(Boolean))].sort().map(s=>`<option>${esc(s)}</option>`).join('');
  sel.value = cur;
}

/* ---------- list + stats ---------- */
function filtered(){
  const q = $('q').value.trim().toLowerCase(), sv = $('fService').value, fs = $('fStatus').value, w = $('fWhen').value, t = todayStr();
  const key = a => (a.apptDate||'')+(a.apptTime||'');
  const rows = all.filter(a => {
    if (sv && a.service !== sv) return false;
    if (fs && stOf(a) !== fs) return false;
    if (w==='upcoming' && !(a.apptDate >= t)) return false;
    if (w==='today' && a.apptDate !== t) return false;
    if (w==='past' && !(a.apptDate < t)) return false;
    if (q && ![a.refCode,a.fullName,a.phone,a.email,a.service,a.notes,a.adminNote].some(x => String(x||'').toLowerCase().includes(q))) return false;
    return true;
  });
  const s = $('fSort').value;
  if (s==='apptAsc') rows.sort((a,b)=>key(a).localeCompare(key(b)));
  else if (s==='apptDesc') rows.sort((a,b)=>key(b).localeCompare(key(a)));
  return rows;
}

function renderList(){
  const t = todayStr(), rows = filtered();
  $('count').textContent = rows.length + (rows.length===1?' appointment':' appointments') + (rows.length!==all.length ? ' (of '+all.length+')' : '');
  $('empty').hidden = rows.length > 0;
  $('rows').innerHTML = rows.map(a => {
    const when = a.apptDate === t ? ['today','Today'] : a.apptDate < t ? ['past','Past'] : ['','Upcoming'];
    const s = stOf(a);
    return `<tr data-id="${esc(a.id)}" class="${s==='cancelled'?'cancelled':''}">
      <td class="ref">${esc(a.refCode)}</td>
      <td><b>${esc(fmtDate(a.apptDate))}</b><span class="sub">${esc(fmtTime(a.apptTime))} · <span class="pill ${when[0]}">${when[1]}</span></span></td>
      <td>${esc(a.service)}${a.coupon?`<span class="sub">Coupon: ${esc(a.coupon)}</span>`:''}</td>
      <td>${esc(a.guests)}</td>
      <td>${esc(a.fullName)}${a.notes?`<span class="sub">“${esc(a.notes)}”</span>`:''}</td>
      <td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a><span class="sub"><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></span></td>
      <td><select class="st" data-s="${s}" data-id="${esc(a.id)}" aria-label="Status">${
        Object.keys(STATUSES).map(k=>`<option value="${k}"${k===s?' selected':''}>${STATUSES[k].label}</option>`).join('')}</select></td>
      <td><button class="view" type="button">Details</button></td>
    </tr>`;
  }).join('');
}

function renderStats(){
  const t = todayStr(), up = all.filter(a => live(a) && a.apptDate >= t);
  $('stTotal').textContent = all.length;
  $('stPending').textContent = all.filter(a => stOf(a)==='pending').length;
  $('stUpcoming').textContent = up.length;
  $('stToday').textContent = all.filter(a => live(a) && a.apptDate === t).length;
  $('stGuests').textContent = up.reduce((n,a)=>n+(+a.guests||0),0);
}

function renderAll(){ renderStats(); renderList(); drawCharts(); }
['q','fService','fStatus','fWhen','fSort'].forEach(id => $(id).addEventListener('input', renderList));

/* inline status + open details */
$('rows').addEventListener('change', async e => {
  const sel = e.target.closest('.st'); if (!sel) return;
  sel.dataset.s = sel.value;
  try { await updateDoc(doc(db,'appointments',sel.dataset.id), {status:sel.value, updatedAt:serverTimestamp()}); toast('Status: '+STATUSES[sel.value].label); }
  catch(err){ toast(friendly(err)); }
});
$('rows').addEventListener('click', e => {
  if (e.target.closest('.st') || e.target.closest('a')) return;
  const tr = e.target.closest('tr'); if (tr) openDetail(tr.dataset.id);
});

/* ---------- detail modal ---------- */
function openDetail(id){ const a = all.find(x=>x.id===id); if (!a) return; openId = id; fillDetail(a,false); $('detailModal').hidden = false; }
function fillDetail(a, keepEdits){
  const rows = [
    ['Reference', a.refCode], ['Service', a.service], ['Date', fmtDate(a.apptDate)], ['Time', fmtTime(a.apptTime)],
    ['Guests', a.guests], ['Guest name', a.fullName], ['Mobile', a.phone], ['Email', a.email],
    ['Account email', a.accountEmail], ['Coupon', a.coupon], ['Guest request', a.notes],
    ['Booked', bookedAt(a) + (a.source==='admin' ? ' (by admin)' : '')]
  ].filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '');
  const dl = $('dBody'); dl.textContent = '';
  rows.forEach(([k,v]) => { const dt=document.createElement('dt'); dt.textContent=k; const dd=document.createElement('dd'); dd.textContent=v; dl.append(dt,dd); });
  if (!keepEdits){ $('dStatus').value = stOf(a); $('dNote').value = a.adminNote || ''; setMsg('dMsg',''); }
}
$('dSave').onclick = async () => {
  if (!openId) return; setMsg('dMsg',''); $('dSave').disabled = true;
  try {
    await updateDoc(doc(db,'appointments',openId), {status:$('dStatus').value, adminNote:$('dNote').value.trim().slice(0,500), updatedAt:serverTimestamp()});
    toast('Saved'); closeModals();
  } catch(e){ setMsg('dMsg', friendly(e)); }
  $('dSave').disabled = false;
};
$('dDelete').onclick = async () => {
  const a = all.find(x=>x.id===openId); if (!a) return;
  if (!confirm('Delete appointment '+a.refCode+' for '+a.fullName+'? This cannot be undone.\n\nTip: use "Cancelled" status to keep a record.')) return;
  try { await deleteDoc(doc(db,'appointments',openId)); toast('Deleted'); closeModals(); }
  catch(e){ setMsg('dMsg', friendly(e)); }
};

/* ---------- new appointment ---------- */
$('newBtn').onclick = () => {
  $('newForm').reset(); $('nGuests').value = 2; $('nDate').min = todayStr(); $('nDate').value = todayStr();
  setMsg('nMsg',''); $('newModal').hidden = false; $('nService').focus();
};
$('newForm').addEventListener('submit', async ev => {
  ev.preventDefault(); setMsg('nMsg','');
  const v = id => $(id).value.trim(), guests = parseInt($('nGuests').value,10), phone = v('nPhone'), email = v('nEmail'), time = v('nTime');
  if (!v('nService')) return setMsg('nMsg','Choose a service.');
  if (!(guests>=1 && guests<=50)) return setMsg('nMsg','Guests must be 1–50.');
  if (!v('nDate')) return setMsg('nMsg','Choose a date.');
  if (!time || time < '07:00' || time > '20:00') return setMsg('nMsg','Time must be between 7:00 AM and 8:00 PM.');
  if (v('nName').length < 2) return setMsg('nMsg','Enter the guest name.');
  if (phone.replace(/\D/g,'').length < 7) return setMsg('nMsg','Enter a valid mobile number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg('nMsg','Email looks invalid.');
  $('nSave').disabled = true;
  try {
    await addDoc(collection(db,'appointments'), {
      refCode:'BAI-'+Math.random().toString(36).slice(2,8).toUpperCase(), uid:auth.currentUser.uid, accountEmail:auth.currentUser.email,
      service:v('nService'), guests, apptDate:v('nDate'), apptTime:time, fullName:v('nName'), phone, email,
      coupon:null, notes:v('nNotes')||null, status:'confirmed', source:'admin', createdAt:serverTimestamp()
    });
    toast('Appointment added'); closeModals();
  } catch(e){ setMsg('nMsg', friendly(e)); }
  $('nSave').disabled = false;
});

/* ---------- password ---------- */
$('pwBtn').onclick = () => { $('pwForm').reset(); setMsg('pMsg',''); $('pwModal').hidden = false; $('pNew').focus(); };
$('pwForm').addEventListener('submit', async ev => {
  ev.preventDefault(); setMsg('pMsg','');
  const a = $('pNew').value, b = $('pNew2').value;
  if (a.length < 8) return setMsg('pMsg','Use at least 8 characters.');
  if (a !== b) return setMsg('pMsg','Passwords do not match.');
  $('pSave').disabled = true;
  try { await updatePassword(auth.currentUser, a); toast('Password updated'); closeModals(); }
  catch(e){ setMsg('pMsg', friendly(e)); }
  $('pSave').disabled = false;
});

/* ---------- modal plumbing ---------- */
function closeModals(){ document.querySelectorAll('.overlay').forEach(o => o.hidden = true); openId = null; }
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]') || (e.target.classList && e.target.classList.contains('overlay'))) closeModals();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

/* ---------- CSV + print ---------- */
$('csvBtn').onclick = () => {
  const cols = ['refCode','status','apptDate','apptTime','service','guests','fullName','phone','email','coupon','notes','adminNote'];
  const cell = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const csv = [cols.join(',')].concat(filtered().map(a => cols.map(c => cell(c==='status' ? stOf(a) : a[c])).join(','))).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'}));
  const l = document.createElement('a'); l.href = url; l.download = 'appointments-'+todayStr()+'.csv'; l.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
};
$('printBtn').onclick = () => window.print();

/* =====================================================
   CHARTS (inline SVG, no library). One hue (blue) for magnitude;
   status uses the fixed status colours with icon + label.
   ===================================================== */
const tip = $('tip');
function showTip(ev, title, value){
  tip.textContent = '';
  const b = document.createElement('b'); b.textContent = value;
  const s = document.createElement('span'); s.textContent = title;
  tip.append(b, s); tip.hidden = false;
  const r = tip.getBoundingClientRect(), x = Math.min(ev.clientX + 14, innerWidth - r.width - 8), y = ev.clientY - r.height - 12;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (y < 8 ? ev.clientY + 18 : y) + 'px';
}
const hideTip = () => { tip.hidden = true; };
function hoverable(el, title, value){
  el.setAttribute('tabindex','0'); el.setAttribute('role','img'); el.setAttribute('aria-label', title+': '+value);
  el.addEventListener('pointermove', e => showTip(e, title, value));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip({clientX:r.left+r.width/2, clientY:r.top}, title, value); });
  el.addEventListener('blur', hideTip);
}
function niceMax(v){ const raw = Math.max(1, v)/4; const p = Math.pow(10, Math.floor(Math.log10(raw))); const st = [1,2,5,10].map(m=>m*p).find(x=>x>=raw); return 4*st; }

/* top-rounded (4px) column from baseline */
function colPath(x, y, w, h){ const r = Math.min(4, w/2, h); return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`; }
/* right-rounded (4px) bar from baseline */
function barPath(x, y, w, h){ const r = Math.min(4, h/2, w); return `M${x},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x}Z`; }

function columnChart(host, items, opts){
  host.textContent = '';
  const W = Math.max(host.clientWidth, 280), H = opts.h || 230, m = {l:34, r:8, t:14, b:26};
  const svg = mk('svg', {viewBox:`0 0 ${W} ${H}`}, host);
  const max = niceMax(Math.max(1, ...items.map(i=>i.v))), iw = W-m.l-m.r, ih = H-m.t-m.b, step = iw/items.length;
  const bw = Math.min(24, Math.max(3, step-2-(step>12?4:0)));
  [0,.25,.5,.75,1].forEach(f => {
    const y = m.t + ih - f*ih, v = max*f;
    mk('line', {x1:m.l, x2:W-m.r, y1:y, y2:y, class: f===0?'axis':'grid'}, svg);
    if (Number.isInteger(v)) mk('text', {x:m.l-6, y:y+4, 'text-anchor':'end'}, svg).textContent = v;
  });
  const peak = Math.max(...items.map(i=>i.v));
  items.forEach((it, i) => {
    const cx = m.l + step*i + step/2, h = it.v/max*ih, x = cx-bw/2, y = m.t+ih-h;
    const g = mk('g', {}, svg);
    const hit = mk('rect', {x:m.l+step*i, y:m.t, width:step, height:ih, class:'hit'}, g);
    if (it.v > 0) mk('path', {d:colPath(x, y, bw, h), class:'bar'}, g);
    hoverable(hit, it.tip, it.v + (it.v===1?' appointment':' appointments'));
    if (it.v > 0 && it.v === peak && items.length <= 31) mk('text', {x:cx, y:y-5, 'text-anchor':'middle', class:'val'}, g).textContent = it.v;
    if (it.tick) mk('text', {x:cx, y:H-8, 'text-anchor':'middle'}, svg).textContent = it.tick;
  });
}

function drawCharts(){
  const t = new Date(); t.setHours(0,0,0,0);
  const liveRows = all.filter(live);

  /* 1. per day */
  const days = [], n = 30;
  for (let i=0;i<n;i++){ const d = new Date(t); d.setDate(d.getDate() + (range==='past' ? i-(n-1) : i)); days.push(d); }
  const per = {}; liveRows.forEach(a => per[a.apptDate] = (per[a.apptDate]||0)+1);
  columnChart($('p1'), days.map((d,i) => ({
    v: per[ymd(d)]||0,
    tip: d.toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'}),
    tick: (i % 5 === (range==='past' ? (n-1)%5 : 0) || i===n-1 && false) ? d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : ''
  })), {h:230});

  /* 2. by service (horizontal bars) */
  const host2 = $('p2'); host2.textContent = '';
  const bySvc = {}; liveRows.forEach(a => { if (a.service) bySvc[a.service] = (bySvc[a.service]||0)+1; });
  const list = Object.entries(bySvc).sort((a,b)=>b[1]-a[1]);
  if (!list.length) host2.innerHTML = '<p class="empty">No data yet.</p>';
  else {
    const W = Math.max(host2.clientWidth, 260), rowH = 34, H = list.length*rowH + 6, lblW = Math.min(130, W*.42), max = list[0][1];
    const svg = mk('svg', {viewBox:`0 0 ${W} ${H}`}, host2);
    list.forEach(([name, v], i) => {
      const y = 3 + i*rowH, bw = Math.max(4, (W-lblW-44)*v/max), g = mk('g', {}, svg);
      mk('text', {x:0, y:y+rowH/2+1, class:'lbl'}, g).textContent = name.length>20 ? name.slice(0,19)+'…' : name;
      const hit = mk('rect', {x:0, y:y, width:W, height:rowH, class:'hit'}, g);
      mk('path', {d:barPath(lblW, y+6, bw, rowH-12), class:'bar'}, g);
      mk('text', {x:lblW+bw+8, y:y+rowH/2+4, class:'val'}, g).textContent = v;
      hoverable(hit, name, v + (v===1?' booking':' bookings'));
    });
  }

  /* 3. status breakdown */
  const host3 = $('p3'); host3.textContent = '';
  const counts = {}; Object.keys(STATUSES).forEach(k => counts[k]=0); all.forEach(a => counts[stOf(a)]++);
  if (!all.length) host3.innerHTML = '<p class="empty">No data yet.</p>';
  else {
    const bar = document.createElement('div'); bar.className = 'stbar';
    const ul = document.createElement('ul'); ul.className = 'stlist';
    Object.keys(STATUSES).forEach(k => {
      const c = counts[k], pct = Math.round(c/all.length*100), s = STATUSES[k];
      if (c){ const seg = document.createElement('span'); seg.style.flex = c; seg.style.background = s.color; seg.title = s.label+': '+c; bar.appendChild(seg); }
      const li = document.createElement('li');
      const ic = document.createElement('span'); ic.className='ic'; ic.style.background=s.color; ic.textContent=s.icon;
      const lb = document.createElement('span'); lb.textContent = s.label;
      const nn = document.createElement('span'); nn.className='n'; nn.textContent=c;
      const pc = document.createElement('span'); pc.className='pc'; pc.textContent=pct+'%';
      li.append(ic, lb, nn, pc); ul.appendChild(li);
    });
    host3.append(bar, ul);
  }

  /* 4. by hour */
  const byHour = {}; liveRows.forEach(a => { const h = parseInt((a.apptTime||'').split(':')[0],10); if (!isNaN(h)) byHour[h] = (byHour[h]||0)+1; });
  const hours = []; for (let h=7; h<=20; h++) hours.push(h);
  const hl = h => ((h%12)||12)+(h>=12?'PM':'AM');
  columnChart($('p4'), hours.map(h => ({v:byHour[h]||0, tip:hl(h)+' – '+hl(h+1), tick:hl(h)})), {h:200});
}

$('rangeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  range = b.dataset.r;
  $('rangeSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x===b));
  drawCharts();
});
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!$('dashView').hidden) drawCharts(); }, 150); });
