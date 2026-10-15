/* "Add to calendar": downloads an .ics file for one appointment (works with Google, Apple and Outlook calendars).
   window.baiICS({ref, service, apptDate:'YYYY-MM-DD', apptTime:'HH:MM', guests, name}) */
(function(){
  var pad=function(n){return String(n).padStart(2,'0')};
  var esc=function(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')};
  function utc(date,time){            // appointment times are Philippine time (UTC+8)
    var d=date.split('-').map(Number),t=(time||'00:00').split(':').map(Number);
    var x=new Date(Date.UTC(d[0],d[1]-1,d[2],t[0]-8,t[1]||0,0));
    return x.getUTCFullYear()+pad(x.getUTCMonth()+1)+pad(x.getUTCDate())+'T'+pad(x.getUTCHours())+pad(x.getUTCMinutes())+'00Z';
  }
  function build(a){
    var start=utc(a.apptDate,a.apptTime);
    var endD=new Date(Date.UTC.apply(null,[].concat(a.apptDate.split('-').map(Number).map(function(v,i){return i===1?v-1:v}),[(+a.apptTime.split(':')[0])-8+1,+a.apptTime.split(':')[1]||0,0])));
    var end=endD.getUTCFullYear()+pad(endD.getUTCMonth()+1)+pad(endD.getUTCDate())+'T'+pad(endD.getUTCHours())+pad(endD.getUTCMinutes())+'00Z';
    var now=new Date(),stamp=now.getUTCFullYear()+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'+pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//bai Hotel Cebu//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      'UID:'+esc(a.ref)+'@baihotel','DTSTAMP:'+stamp,'DTSTART:'+start,'DTEND:'+end,
      'SUMMARY:'+esc('bai Hotel: '+a.service),
      'DESCRIPTION:'+esc('Reference '+a.ref+(a.guests?' - '+a.guests+' guest(s)':'')+'. Show your QR code at the front desk.'),
      'LOCATION:'+esc('bai Hotel Cebu, Mandaue City, Cebu, Philippines'),
      'BEGIN:VALARM','TRIGGER:-PT2H','ACTION:DISPLAY','DESCRIPTION:'+esc('Appointment at bai Hotel in 2 hours'),'END:VALARM',
      'END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  window.baiICS=function(a){
    var blob=new Blob([build(a)],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob);
    var l=document.createElement('a');l.href=url;l.download='bai-hotel-'+a.ref+'.ics';document.body.appendChild(l);l.click();l.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},3000);
  };
  window.baiICS._build=build;
})();
