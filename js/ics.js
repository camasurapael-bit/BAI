/* "Add to calendar".
   window.baiCal(appt) opens a small chooser: Google Calendar (opens straight in the calendar app / website)
   or an .ics file (Apple, Outlook, others).  window.baiICS(appt) downloads the .ics directly.
   appt = {ref, service, apptDate:'YYYY-MM-DD', apptTime:'HH:MM', guests, name}                          */
(function(){
  var pad=function(n){return String(n).padStart(2,'0')};
  var esc=function(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')};
  var PLACE='bai Hotel Cebu, Mandaue City, Cebu, Philippines';
  function stamp(d){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+'Z'}
  function span(a){                      // appointment times are Philippine time (UTC+8); length 1 hour
    var d=a.apptDate.split('-').map(Number),t=(a.apptTime||'00:00').split(':').map(Number);
    var s=new Date(Date.UTC(d[0],d[1]-1,d[2],t[0]-8,t[1]||0,0));
    return {start:s,end:new Date(s.getTime()+3600e3)};
  }
  function note(a){return 'Reference '+a.ref+(a.guests?' - '+a.guests+' guest(s)':'')+'. Show your QR code at the front desk.'}
  function build(a){
    var sp=span(a);
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//bai Hotel Cebu//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      'UID:'+esc(a.ref)+'@baihotel','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(sp.start),'DTEND:'+stamp(sp.end),
      'SUMMARY:'+esc('bai Hotel: '+a.service),'DESCRIPTION:'+esc(note(a)),'LOCATION:'+esc(PLACE),
      'BEGIN:VALARM','TRIGGER:-PT2H','ACTION:DISPLAY','DESCRIPTION:'+esc('Appointment at bai Hotel in 2 hours'),'END:VALARM',
      'END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  function googleUrl(a){
    var sp=span(a),q=function(k,v){return k+'='+encodeURIComponent(v)};
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&'+[q('text','bai Hotel: '+a.service),'dates='+stamp(sp.start)+'/'+stamp(sp.end),q('details',note(a)),q('location',PLACE)].join('&');
  }
  function download(a){
    var blob=new Blob([build(a)],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob);
    var l=document.createElement('a');l.href=url;l.download='bai-hotel-'+a.ref+'.ics';document.body.appendChild(l);l.click();l.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},3000);
  }
  function css(){
    if(document.getElementById('baiCalCss'))return;
    var s=document.createElement('style');s.id='baiCalCss';
    s.textContent='.bai-cal{position:fixed;inset:0;z-index:99999;background:rgba(3,6,14,.7);display:flex;align-items:flex-end;justify-content:center;padding:0;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}'
    +'.bai-cal-box{width:100%;max-width:420px;background:#0e1830;color:#ecf0f6;border:1px solid rgba(255,255,255,.12);border-radius:20px 20px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));font-family:Manrope,system-ui,sans-serif;display:grid;gap:10px;animation:baiUp .22s ease-out}'
    +'@keyframes baiUp{from{transform:translateY(30px);opacity:0}}'
    +'.bai-cal-box h4{font-family:"Playfair Display",Georgia,serif;font-size:1.25rem;font-weight:600;margin:0}'
    +'.bai-cal-box p{margin:0 0 4px;font-size:.82rem;color:#b6bfd1;line-height:1.4}'
    +'.bai-cal-box a,.bai-cal-box button{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:999px;font:700 .92rem Manrope,system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1px solid rgba(255,255,255,.16);background:transparent;color:#ecf0f6}'
    +'.bai-cal-box a.main{background:linear-gradient(135deg,#c66a3a,#e08760);border-color:#c66a3a;color:#fff}'
    +'@media(min-width:560px){.bai-cal{align-items:center}.bai-cal-box{border-radius:20px}}';
    document.head.appendChild(s);
  }
  window.baiCal=function(a){
    css();
    var ov=document.createElement('div');ov.className='bai-cal';
    ov.innerHTML='<div class="bai-cal-box" role="dialog" aria-modal="true" aria-label="Add to calendar"><h4>Add to calendar</h4><p></p></div>';
    var box=ov.firstChild;box.querySelector('p').textContent=a.service+' · '+a.apptDate+' '+a.apptTime;
    var g=document.createElement('a');g.className='main';g.href=googleUrl(a);g.target='_blank';g.rel='noopener';g.textContent='Google Calendar';
    var f=document.createElement('button');f.type='button';f.textContent='Apple / Outlook (.ics file)';
    var c=document.createElement('button');c.type='button';c.textContent='Cancel';
    var close=function(){ov.remove()};
    g.addEventListener('click',function(){setTimeout(close,300)});
    f.addEventListener('click',function(){download(a);close()});c.addEventListener('click',close);
    ov.addEventListener('click',function(e){if(e.target===ov)close()});
    box.append(g,f,c);document.body.appendChild(ov);
  };
  window.baiICS=download;window.baiICS._build=build;window.baiCal._google=googleUrl;
})();
