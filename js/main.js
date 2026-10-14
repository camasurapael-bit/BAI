/* block pinch / double-tap zoom (iOS Safari ignores user-scalable) */
['gesturestart','gesturechange','gestureend'].forEach(function(e){document.addEventListener(e,function(ev){ev.preventDefault()})});
var _lt=0;document.addEventListener('touchend',function(ev){var n=Date.now();if(n-_lt<350)ev.preventDefault();_lt=n},{passive:false});
const nav=document.getElementById('nav');
window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',window.scrollY>40));
const h=document.getElementById('hamburger'),nL=document.getElementById('navLinks'),nb=document.getElementById('navBackdrop');
nb.addEventListener('click',()=>setMenu(false));
function setMenu(open){nb.classList.toggle('show',open);nL.classList.toggle('open',open);document.body.classList.toggle('menu-open',open);h.setAttribute('aria-expanded',open);h.setAttribute('aria-label',open?'Close menu':'Open menu')}
h.addEventListener('click',()=>setMenu(!nL.classList.contains('open')));
nL.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
window.addEventListener('resize',()=>{if(window.innerWidth>900)setMenu(false)});

const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

const cio=new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target,target=parseFloat(el.dataset.count),dec=parseInt(el.dataset.dec||0);const dur=1600,t0=performance.now();(function step(t){const p=Math.min((t-t0)/dur,1),ease=1-Math.pow(1-p,3);el.textContent=(target*ease).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,',');if(p<1)requestAnimationFrame(step)})(t0);cio.unobserve(el)})},{threshold:.6});
document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));

const tS=document.getElementById('time');
function fmtTime(t){const[h,m]=t.split(':').map(Number);return((h%12)||12)+':'+String(m).padStart(2,'0')+' '+(h>=12?'PM':'AM')}

const dI=document.getElementById('date');
const today=new Date();dI.min=today.toISOString().split('T')[0];

document.querySelectorAll('.svc-link').forEach(l=>l.addEventListener('click',()=>{document.getElementById('service').value=l.dataset.service}));
document.querySelectorAll('.gallery-actions .pill').forEach(p=>p.addEventListener('click',()=>{document.querySelectorAll('.gallery-actions .pill').forEach(x=>x.classList.remove('active'));p.classList.add('active')}));

const form=document.getElementById('bookForm'),modal=document.getElementById('modal');
let lastReceipt=null;
/* Save the receipt (with QR) as a PNG image */
document.getElementById('saveReceipt').addEventListener('click',function(){
  if(!lastReceipt)return;
  var r=lastReceipt,W=640,H=900,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  x.fillStyle='#f7f3ec';x.fillRect(0,0,W,H);
  x.fillStyle='#c66a3a';x.fillRect(0,0,W,150);
  x.fillStyle='#fff';x.textAlign='center';x.font='600 44px Georgia, serif';x.fillText('bai Hotel',W/2,78);
  x.font='500 15px Arial, sans-serif';x.fillText('CEBU \u00B7 MANDAUE',W/2,110);
  x.fillStyle='#16244a';x.font='600 30px Georgia, serif';x.fillText('Appointment Receipt',W/2,218);
  x.fillStyle='#c66a3a';x.font='700 34px Courier New, monospace';x.fillText(r.ref,W/2,272);
  var rows=[['Service',r.service],['Date & time',r.when],['Guests',String(r.guests)],['Name',r.name],['Mobile',r.phone]],y=330;
  rows.forEach(function(p){x.textAlign='left';x.fillStyle='#7a8194';x.font='700 14px Arial, sans-serif';x.fillText(p[0].toUpperCase(),60,y);
    x.fillStyle='#16244a';x.font='600 20px Arial, sans-serif';x.textAlign='right';x.fillText(p[1],W-60,y+1);
    x.strokeStyle='#e3dccf';x.beginPath();x.moveTo(60,y+16);x.lineTo(W-60,y+16);x.stroke();y+=54;});
  try{window.baiQR.canvas(x,location.origin+'/admin.html?ref='+encodeURIComponent(r.ref),W/2-110,y+14,220)}catch(e){}
  x.textAlign='center';x.fillStyle='#7a8194';x.font='500 15px Arial, sans-serif';
  x.fillText('Show this QR code at the front desk.',W/2,y+270);
  x.fillText('Status: pending confirmation',W/2,y+296);
  c.toBlob(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='bai-receipt-'+r.ref+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000)},'image/png');
});
/* Appointments are saved to Firestore (collection: appointments) via window.baiAuth.saveAppointment */
function saveAppointment(row){ return window.baiAuth.saveAppointment(row); }
function setV(i,o){i.closest('.f-group').classList.toggle('invalid',!o);return o}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const svc=document.getElementById('service'),gx=document.getElementById('guests'),nm=document.getElementById('name'),ph=document.getElementById('phone'),em=document.getElementById('email');
  let ok=true;
  ok=setV(svc,!!svc.value)&&ok;
  ok=setV(gx,gx.value>=1&&gx.value<=50)&&ok;
  ok=setV(dI,!!dI.value&&dI.value>=dI.min)&&ok;
  ok=setV(tS,!!tS.value&&tS.value>='07:00'&&tS.value<='20:00')&&ok;
  ok=setV(nm,nm.value.trim().length>=2)&&ok;
  ok=setV(ph,ph.value.replace(/\D/g,'').length>=7)&&ok;
  ok=setV(em,/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value))&&ok;
  if(!ok)return;
  if(window.baiAuth&&!window.baiAuth.isSignedIn()){window.baiAuth.require(()=>form.requestSubmit());return}
  const ref='BAI-'+Math.random().toString(36).slice(2,8).toUpperCase();
  const u=window.baiAuth.getUser(), btn=form.querySelector('.submit-btn'), btnTxt=btn.textContent;
  btn.disabled=true;btn.textContent='Saving…';
  try{
    await saveAppointment({
      refCode:ref, accountEmail:u&&u.email||null,
      service:svc.value, guests:parseInt(gx.value,10),
      apptDate:dI.value, apptTime:tS.value,
      fullName:nm.value.trim(), phone:ph.value.trim(), email:em.value.trim(),
      coupon:(document.getElementById('coupon').value||'').trim()||null,
      notes:(document.getElementById('notes').value||'').trim()||null
    });
  }catch(err){
    console.error(err);
    alert('Sorry, we could not save your appointment. Please check your connection and try again.');
    btn.disabled=false;btn.textContent=btnTxt;return;
  }
  btn.disabled=false;btn.textContent=btnTxt;
  document.getElementById('refCode').textContent=ref;
  const d=new Date(dI.value+'T'+tS.value+':00');
  lastReceipt={ref:ref,service:svc.value,guests:gx.value,apptDate:dI.value,apptTime:tS.value,name:nm.value.trim(),phone:ph.value.trim(),when:d.toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+' · '+fmtTime(tS.value)};
  var qrUrl=location.origin+'/admin.html?ref='+encodeURIComponent(ref);
  try{document.getElementById('qrBox').innerHTML=window.baiQR.svg(qrUrl,168)}catch(e){}
  window.baiAuth.notify({type:'received',ref:ref,name:nm.value.trim(),service:svc.value,guests:parseInt(gx.value,10),apptDate:dI.value,apptTime:tS.value}).catch(function(){});
  document.getElementById('modalSummary').innerHTML='<b>'+svc.value+'</b> for <b>'+gx.value+' guest(s)</b><br>'+d.toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+' · '+fmtTime(tS.value)+'<br>Under the name <b>'+nm.value.trim()+'</b>';
  modal.classList.add('open');form.reset();gx.value=2;
});
document.getElementById('modalClose').addEventListener('click',()=>modal.classList.remove('open'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});

const lb=document.getElementById('lightbox'),lbI=document.getElementById('lbImg');
document.querySelectorAll('.gal-item img').forEach(img=>{img.parentElement.addEventListener('click',()=>{lbI.src=img.src;lbI.alt=img.alt;lb.classList.add('open')})});
document.getElementById('lbClose').addEventListener('click',()=>lb.classList.remove('open'));
lb.addEventListener('click',e=>{if(e.target===lb)lb.classList.remove('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);lb.classList.remove('open');modal.classList.remove('open')}});
