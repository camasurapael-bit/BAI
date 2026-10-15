/* ============================================================
   FIREBASE AUTH
   1. Firebase console > Project settings > Your apps > Web app > copy config
   2. Authentication > Sign-in method > enable "Google" and "Email/Password"
   3. Authentication > Settings > Authorized domains: add your domain / localhost
   NOTE: Google popup does NOT work when opened as file:// — use localhost or hosting.
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyA-Po8Edgg5uTlq4MUosj94OBcSjUB_Das",
  authDomain: "bai-hotel-cebu.firebaseapp.com",
  projectId: "bai-hotel-cebu",
  storageBucket: "bai-hotel-cebu.firebasestorage.app",
  messagingSenderId: "770474829422",
  appId: "1:770474829422:web:a1ed04cb171fc65bb5687f"
};

const $ = id => document.getElementById(id);
const modal = $('authModal'), msg = $('authMsg'), form = $('authForm');
const ADMIN_EMAIL = 'admin@gmail.com';
const isAdminUser = u => !!u && (u.email||'').toLowerCase() === ADMIN_EMAIL;
let mode = 'signup', user = null, fb = null, afterAuth = null;
const configured = !firebaseConfig.apiKey.startsWith('YOUR_');
let readyResolve; const ready = new Promise(r=>readyResolve=r);
if (!configured) readyResolve();

function show(text, type){ msg.textContent = text; msg.className = 'auth-msg show ' + (type||'error'); }
function clearMsg(){ msg.className = 'auth-msg'; msg.textContent=''; }
function busy(b){ ['authSubmit','googleBtn'].forEach(i=>$(i).disabled=b); }

function setMode(m){
  mode = m; clearMsg();
  const su = m === 'signup', confirming = !!afterAuth;
  $('tabSignup').classList.toggle('active', su);
  $('tabLogin').classList.toggle('active', !su);
  $('tabSignup').setAttribute('aria-selected', su);
  $('tabLogin').setAttribute('aria-selected', !su);
  $('authSub').textContent = confirming
    ? (su ? 'One last step: create an account to confirm your appointment. Your details are saved.'
          : 'Log in to confirm your appointment. Your details are saved.')
    : (su ? 'Create an account to reserve your stay, table, spa ritual, or pool day.'
          : 'Welcome back. Log in to continue your booking.');
  $('nameGroup').style.display = su ? '' : 'none';
  $('authSubmit').textContent = su ? 'Create account' : 'Log in';
  $('authPass').autocomplete = su ? 'new-password' : 'current-password';
  $('forgotBtn').style.display = su ? 'none' : '';
}
$('tabLogin').onclick = () => setMode('login');
$('tabSignup').onclick = () => setMode('signup');
function openAuth(cb){ afterAuth = cb || null; setMode('signup'); modal.classList.add('open'); setTimeout(()=>$('authEmail').focus(),250); }
function closeAuth(){ modal.classList.remove('open'); clearMsg(); afterAuth = null; }
function goBooking(){
  if (isAdminUser(user)){ location.href = 'admin.html'; return; }   // admin signs in here -> dashboard
  const cb = afterAuth;
  closeAuth();
  if (cb){ cb(); return; }   // came from "Confirm appointment" -> finish the booking
  if (user){
    const n=$('name'), e=$('email');
    if (n && !n.value) n.value = user.displayName || '';
    if (e && !e.value) e.value = user.email || '';
  }
  const t = $('booking'); if (t) t.scrollIntoView({behavior:'smooth'});
}

/* Any "Book Appointment" / "Reserve" link -> account first */
document.querySelectorAll('a[href="#booking"]').forEach(a=>{
  a.addEventListener('click', ev=>{
    if (user) return;               // already signed in -> normal scroll to booking
    ev.preventDefault(); openAuth();
  });
});
window.baiAuth = {
  isSignedIn: () => !!user,
  getUser: () => user ? {uid:user.uid, email:user.email||null, name:user.displayName||null} : null,
  /* save a booking to Firestore: collection "appointments" */
  saveAppointment: async data => {
    if (!user) throw new Error('not signed in');
    const {F,db} = await loadFirebase();
    await F.addDoc(F.collection(db,'appointments'), {...data, uid:user.uid, createdAt:F.serverTimestamp()});
  },
  /* admin-managed availability (public document settings/availability): {blockedDates:[], capacity} */
  getSettings: async () => {
    try { const {F,db} = await loadFirebase(); const s = await F.getDoc(F.doc(db,'settings','availability')); return s.exists() ? s.data() : {}; }
    catch(e){ return {}; }
  },
  /* server-side capacity check; fails open (never blocks booking because the helper is unavailable) */
  checkSlot: async p => {
    try {
      if (!user) return {ok:true};
      const token = await user.getIdToken();
      const r = await fetch('/api/slot', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token}, body:JSON.stringify(p)});
      if (!r.ok) return {ok:true};
      return await r.json();
    } catch(e){ return {ok:true}; }
  },
  /* email the signed-in guest their receipt (server: /api/notify) */
  notify: async payload => {
    if (!user) return;
    const token = await user.getIdToken();
    const r = await fetch('/api/notify', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token}, body:JSON.stringify(payload)});
    if (!r.ok) throw new Error('email ' + r.status);
  },
  /* run cb once the visitor is signed in; shows account creation if not */
  require: async cb => {
    await Promise.race([ready, new Promise(r=>setTimeout(r,4000))]);
    if (user) cb(); else openAuth(cb);
  }
};
$('authClose').onclick = closeAuth;
modal.addEventListener('click', e=>{ if(e.target===modal) closeAuth(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAuth(); });

function friendly(err){
  const c = err && err.code || '';
  const map = {
    'auth/email-already-in-use':'That email is already registered. Try logging in.',
    'auth/invalid-email':'Please enter a valid email.',
    'auth/weak-password':'Password must be at least 6 characters.',
    'auth/invalid-credential':'Wrong email or password.',
    'auth/user-not-found':'No account found with that email.',
    'auth/wrong-password':'Wrong email or password.',
    'auth/popup-closed-by-user':'Google sign-in was closed before finishing.',
    'auth/popup-blocked':'Your browser blocked the Google popup. Allow popups and try again.',
    'auth/unauthorized-domain':'This domain is not authorized in Firebase (Authentication > Settings > Authorized domains).',
    'auth/operation-not-supported-in-this-environment':'Google sign-in needs http(s) or localhost, not a file:// page.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/too-many-requests':'Too many attempts. Try again in a few minutes.',
    'auth/missing-email':'Please enter your email.'
  };
  return map[c] || (err && err.message) || 'Something went wrong. Please try again.';
}

async function loadFirebase(){
  if (fb) return fb;
  if (!configured) throw {message:'Firebase is not set up yet. Paste your Firebase config in the script (firebaseConfig).'};
  const V='10.12.2', base='https://www.gstatic.com/firebasejs/'+V+'/';
  const [{initializeApp},A,F] = await Promise.all([import(base+'firebase-app.js'), import(base+'firebase-auth.js'), import(base+'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig), auth = A.getAuth(app), db = F.getFirestore(app);
  fb = {A, auth, F, db};
  /* only verified accounts count as signed in (Google is verified automatically; the admin account is exempt) */
  A.onAuthStateChanged(auth, u=>{ user = (u && (u.emailVerified || isAdminUser(u))) ? u : null; renderUser(); readyResolve(); });
  return fb;
}
function renderUser(){
  const bar=$('authBar');
  if (user){ $('authBarText').textContent = 'Signed in as ' + (user.displayName || user.email); bar.classList.add('show'); $('adminLink').hidden = !isAdminUser(user); }
  else bar.classList.remove('show');
  const nd = $('navDashboard'); if (nd) nd.hidden = !isAdminUser(user);
  const nm = $('navMyLi'); if (nm) nm.hidden = isAdminUser(user);
}
if (configured) loadFirebase().catch(()=>{});   // restore session on page load

$('googleBtn').onclick = async ()=>{
  clearMsg(); busy(true);
  try{
    const {A,auth} = await loadFirebase();
    const res = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
    user = res.user; renderUser(); goBooking();
  }catch(err){ show(friendly(err)); }
  busy(false);
};

form.addEventListener('submit', async ev=>{
  ev.preventDefault(); clearMsg();
  const name=$('authName'), email=$('authEmail'), pass=$('authPass');
  const ok1 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const ok2 = pass.value.length >= 6;
  const ok0 = mode==='login' || name.value.trim().length >= 2;
  name.closest('.f-group').classList.toggle('invalid',!ok0);
  email.closest('.f-group').classList.toggle('invalid',!ok1);
  pass.closest('.f-group').classList.toggle('invalid',!ok2);
  if(!(ok0&&ok1&&ok2)) return;
  if (mode==='signup' && email.value.trim().toLowerCase()===ADMIN_EMAIL){ show('This email is reserved. Please use another email.'); return; }
  busy(true);
  try{
    const {A,auth} = await loadFirebase();
    if (mode==='signup'){
      const addr = email.value.trim();
      const cred = await A.createUserWithEmailAndPassword(auth, addr, pass.value);
      await A.updateProfile(cred.user, {displayName:name.value.trim()});
      await A.sendEmailVerification(cred.user);
      await A.signOut(auth); user = null; renderUser();
      form.reset(); setMode('login'); email.value = addr;
      show('Account created! We sent a verification link to ' + addr + '. Open it (check Spam too), then log in here.','info');
    } else {
      const cred = await A.signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
      if (!cred.user.emailVerified && !isAdminUser(cred.user)){
        let sent = true;
        try{ await A.sendEmailVerification(cred.user); }catch(e){ sent = false; }
        await A.signOut(auth); user = null; renderUser();
        show('Please verify your email first. ' + (sent ? 'We just sent a new verification link to ' + email.value.trim() + '.' : 'A verification link was already sent, so check your inbox and Spam folder.'));
        busy(false); return;
      }
      user = cred.user; renderUser(); form.reset(); goBooking();
    }
  }catch(err){ show(friendly(err)); }
  busy(false);
});

$('forgotBtn').onclick = async ()=>{
  clearMsg();
  const email=$('authEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ show('Type your email above first, then tap "Forgot password?".'); return; }
  try{ const {A,auth}=await loadFirebase(); await A.sendPasswordResetEmail(auth,email); show('Password reset link sent. Check your email.','info'); }
  catch(err){ show(friendly(err)); }
};

$('signOutBtn').onclick = async ()=>{ try{ const {A,auth}=await loadFirebase(); await A.signOut(auth); user=null; renderUser(); }catch(e){} };


/* "My Appointment" menu button: log in first if needed, then open the page */
const navMy = $('navMy');
if (navMy) navMy.addEventListener('click', ev => { ev.preventDefault(); window.baiAuth.require(() => { location.href = 'my-appointments.html'; }); });
/* arriving from my-appointments.html while logged out */
if (new URLSearchParams(location.search).get('login') === 'my') window.baiAuth.require(() => { location.href = 'my-appointments.html'; });
