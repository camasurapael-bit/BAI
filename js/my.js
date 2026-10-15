/* My Appointments: a signed-in guest sees their own bookings (live), shows the QR code and can reschedule.
   Rules (also enforced in firestore.rules): only pending/confirmed bookings, up to 2 reschedules,
   and the new time must be at least CUTOFF_HOURS from now. A rescheduled booking returns to "pending". */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth, onAuthStateChanged, signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA-Po8Edgg5uTlq4MUosj94OBcSjUB_Das",
  authDomain: "bai-hotel-cebu.firebaseapp.com",
  projectId: "bai-hotel-cebu",
  storageBucket: "bai-hotel-cebu.firebasestorage.app",
  messagingSenderId: "770474829422",
  appId: "1:770474829422:web:a1ed04cb171fc65bb5687f"
};
const CUTOFF_HOURS = 2, MAX_RESCHEDULES = 2, ADMIN_EMAIL = 'admin@gmail.com';

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const stOf = a => a.status || 'pending';
const startOf = a => new Date(a.apptDate + 'T' + (a.apptTime || '00:00') + ':00');
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
const fmtTime = t => { const [h,m] = (t||'0:0').split(':').map(Number); return ((h%12)||12)+':'+pad(m)+' '+(h>=12?'PM':'AM'); };
const todayStr = () => { const d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
const LABEL = {pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Declined / cancelled'};
const COLOR = {pending:'#f2b84b', confirmed:'#5fc59a', completed:'#6ea8f0', cancelled:'#ff8a7a'};

let all = [], tab = 'up', unsub = null, rsId = null, toastT = null;

function toast(t){ const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3600); }
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function isUpcoming(a){ return (stOf(a)==='pending' || stOf(a)==='confirmed') && startOf(a) >= new Date(); }
function resched(a){
  const s = stOf(a);
  if (s === 'cancelled') return {ok:false, why:'This appointment was declined or cancelled.'};
  if (s === 'completed') return {ok:false, why:'This appointment is completed.'};
  if ((a.rescheduleCount||0) >= MAX_RESCHEDULES) return {ok:false, why:'Reschedule limit reached ('+MAX_RESCHEDULES+').'};
  const ms = startOf(a) - Date.now();
  if (ms < 0) return {ok:false, why:'This appointment has already passed.'};
  if (ms < CUTOFF_HOURS*3600e3) return {ok:false, why:'Rescheduling closes '+CUTOFF_HOURS+' hours before the appointment. Please call the hotel.'};
  return {ok:true};
}

function render(){
  const up = all.filter(isUpcoming).sort((a,b) => startOf(a)-startOf(b));
  const past = all.filter(a => !isUpcoming(a)).sort((a,b) => startOf(b)-startOf(a));
  $('cUp').textContent = up.length; $('cPast').textContent = past.length;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const list = tab === 'up' ? up : past, box = $('list'); box.textContent = '';
  $('empty').hidden = list.length > 0;
  if (!list.length) $('empty').textContent = tab === 'up' ? 'No upcoming appointments yet. Tap "Book new" to make one.' : 'Nothing here yet.';
  list.forEach(a => {
    const s = stOf(a), r = resched(a), c = el('article', 'card' + (tab==='past' ? ' past' : ''));
    c.style.setProperty('--st', COLOR[s] || '#c66a3a');
    const r1 = el('div','row1'); r1.append(el('span','ref',a.refCode||''), el('span','pill '+s, LABEL[s]||s)); 
    const w = el('div','when'); w.append(el('b',null,fmtDate(a.apptDate)), el('span',null,fmtTime(a.apptTime)));
    const m = el('div','meta'); const g = el('span'); g.append('Guests ', el('b',null,String(a.guests||'')));
    m.append(g); if (a.rescheduleCount){ const rr = el('span'); rr.append('Rescheduled ', el('b',null,a.rescheduleCount+'x')); m.append(rr); }
    c.append(r1, el('h3','svc',a.service||''), w, m);
    if (a.notes) c.append(el('p','note','“'+a.notes+'”'));
    const acts = el('div','acts');
    const q = el('button','btn ghost small','QR code'); q.type = 'button'; q.onclick = () => openQR(a);
    const rb = el('button','btn small','Reschedule'); rb.type = 'button'; rb.disabled = !r.ok; rb.onclick = () => openResched(a);
    acts.append(q, rb); if (!r.ok && tab==='up') acts.append(el('p','lock',r.why)); 
    if (!r.ok && tab==='past' && s!=='completed' && s!=='cancelled') acts.append(el('p','lock',r.why));
    c.append(acts); box.append(c);
  });
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; render(); });
setInterval(() => { if (!$('board').hidden) render(); }, 60000);   // buttons lock themselves as the cut-off passes

/* ----- QR ----- */
function openQR(a){
  $('qrRef').textContent = a.refCode;
  try { $('qrBox').innerHTML = window.baiQR.svg(location.origin + '/admin.html?ref=' + encodeURIComponent(a.refCode), 200); } catch(e){ $('qrBox').textContent = a.refCode; }
  $('qrModal').hidden = false;
}

/* ----- reschedule ----- */
function openResched(a){
  const r = resched(a); if (!r.ok) return toast(r.why);
  rsId = a.id; $('rsMsg').textContent = '';
  $('rsCur').textContent = 'Now: ' + fmtDate(a.apptDate) + ' · ' + fmtTime(a.apptTime) + ' (' + (a.service||'') + ')';
  $('rsDate').min = todayStr(); $('rsDate').value = a.apptDate; $('rsTime').value = a.apptTime || '';
  $('rsModal').hidden = false; $('rsDate').focus();
}
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $('rsModal').hidden = true; $('qrModal').hidden = true; }));
['rsModal','qrModal'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id) $(id).hidden = true; }));
document.addEventListener('keydown', e => { if (e.key === 'Escape'){ $('rsModal').hidden = true; $('qrModal').hidden = true; } });

$('rsForm').addEventListener('submit', async ev => {
  ev.preventDefault(); const msg = t => $('rsMsg').textContent = t; msg('');
  const a = all.find(x => x.id === rsId); if (!a) return;
  const r = resched(a); if (!r.ok) return msg(r.why);
  const d = $('rsDate').value, t = $('rsTime').value;
  if (!d) return msg('Choose a new date.');
  if (!t || t < '07:00' || t > '20:00') return msg('Time must be between 7:00 AM and 8:00 PM.');
  if (d === a.apptDate && t === a.apptTime) return msg('That is the same date and time.');
  if (new Date(d+'T'+t+':00') - Date.now() < CUTOFF_HOURS*3600e3) return msg('The new time must be at least '+CUTOFF_HOURS+' hours from now.');
  $('rsSave').disabled = true;
  try {
    await updateDoc(doc(db,'appointments',a.id), {apptDate:d, apptTime:t, status:'pending', rescheduledAt:serverTimestamp(), rescheduleCount:(a.rescheduleCount||0)+1});
    $('rsModal').hidden = true; toast('Rescheduled. Waiting for the hotel to confirm the new time.');
    sendEmail({type:'rescheduled', ref:a.refCode, name:a.fullName, service:a.service, guests:a.guests, apptDate:d, apptTime:t});
  } catch(e){
    console.error(e);
    msg(e && e.code === 'permission-denied' ? 'This booking can no longer be rescheduled online. Please call the hotel.' : 'Could not reschedule. Check your connection and try again.');
  }
  $('rsSave').disabled = false;
});
async function sendEmail(payload){
  try { const token = await auth.currentUser.getIdToken();
    await fetch('/api/notify', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token}, body:JSON.stringify(payload)}); } catch(e){}
}

/* ----- session ----- */
$('outBtn').onclick = async () => { try { await signOut(auth); } finally { location.replace('index.html'); } };
function gate(show, text){ $('gate').hidden = !show; $('board').hidden = show; if (text) $('who').textContent = text; }
onAuthStateChanged(auth, u => {
  if (unsub){ unsub(); unsub = null; }
  if (!u || (!u.emailVerified && (u.email||'').toLowerCase() !== ADMIN_EMAIL)){ $('outBtn').hidden = true; all = []; return gate(true, 'You are not logged in.'); }
  if ((u.email||'').toLowerCase() === ADMIN_EMAIL){ location.replace('admin.html'); return; }
  $('outBtn').hidden = false; gate(false, 'Signed in as ' + (u.displayName || u.email));
  unsub = onSnapshot(query(collection(db,'appointments'), where('uid','==',u.uid)), snap => {
    all = snap.docs.map(d => ({id:d.id, ...d.data()})); render();
  }, err => { console.error(err); $('who').textContent = 'Could not load your appointments. Please refresh.'; });
});
