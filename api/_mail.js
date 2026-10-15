/* Shared helpers for the email functions (files starting with "_" are not public endpoints). */
const HOTEL = 'bai Hotel Cebu';
const PHONE = '+63 (032) 342 8888';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const fmtDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-PH', {timeZone:'UTC', weekday:'long', month:'long', day:'numeric', year:'numeric'}) : '';
const fmtTime = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = +m[1]; return ((h % 12) || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM'); };

const STATUS = {
  received:   {subject:'We received your appointment request', title:'Request received', color:'#c66a3a',
               lead:'Thank you! Your request is now with our concierge team. We will email you again as soon as it is confirmed or declined.'},
  rescheduled:{subject:'We received your new schedule', title:'Reschedule received', color:'#c66a3a',
               lead:'Your appointment has been moved to the new date and time below. It is pending again, and we will email you as soon as the hotel confirms it.'},
  confirmed:  {subject:'Your appointment is confirmed', title:'Appointment confirmed', color:'#2e9e6b',
               lead:'Good news! Your appointment is confirmed. We look forward to welcoming you at bai Hotel Cebu.'},
  cancelled:  {subject:'Update on your appointment request', title:'Appointment declined', color:'#c93a3a',
               lead:'We are sorry, but we are unable to accommodate this appointment. You are welcome to book another date or time, or call us and we will gladly help.'},
  selfcancel: {subject:'Your appointment was cancelled', title:'Appointment cancelled', color:'#c93a3a',
               lead:'As requested, your appointment has been cancelled. You are welcome to book again any time.'},
  completed:  {subject:'Thank you for visiting bai Hotel Cebu', title:'Thank you for your visit', color:'#3987e5',
               lead:'Thank you for choosing bai Hotel Cebu. We hope you enjoyed your visit. We would love to hear how it went: open My Appointment on our website and leave a rating.'},
  reminder:   {subject:'Reminder: your appointment is tomorrow', title:'Appointment reminder', color:'#b8892f',
               lead:'This is a friendly reminder of your appointment tomorrow at bai Hotel Cebu. We look forward to seeing you!'}
};
const QR_KINDS = {received:1, rescheduled:1, confirmed:1, reminder:1};

function detailRows(d) {
  return [['Reference', d.ref], ['Service', d.service], ['Date', fmtDate(d.apptDate)], ['Time', fmtTime(d.apptTime)], ['Guests', d.guests]]
    .filter(r => r[1]).map(r => `<tr><td style="padding:8px 0;color:#7a8194;font-size:12px;letter-spacing:1px;text-transform:uppercase;width:110px">${esc(r[0])}</td><td style="padding:8px 0;color:#16244a;font-size:15px;font-weight:600">${esc(r[1])}</td></tr>`).join('');
}

function shell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f1ece3;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#c66a3a;padding:26px 28px;color:#fff"><div style="font-family:Georgia,serif;font-size:28px;font-weight:600">bai Hotel</div><div style="font-size:12px;letter-spacing:3px;margin-top:4px">CEBU &middot; MANDAUE</div></td></tr>
<tr><td style="padding:28px">${inner}</td></tr>
<tr><td style="background:#16244a;color:#b6bfd1;font-size:12px;text-align:center;padding:16px">${HOTEL} &middot; This is an automated message about your booking.</td></tr>
</table></td></tr></table></body></html>`;
}

function buildHtml(kind, d, site, extraMsg) {
  const s = STATUS[kind];
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(site + '/admin.html?ref=' + d.ref);
  const note = extraMsg ? `<div style="margin:18px 0;padding:14px 16px;background:#fff7ef;border-left:4px solid #c66a3a;border-radius:6px;color:#16244a;font-size:14px;line-height:1.5"><b>Message from the hotel</b><br>${esc(extraMsg).replace(/\n/g, '<br>')}</div>` : '';
  const link = kind === 'completed' ? `<p style="text-align:center;margin:18px 0 0"><a href="${esc(site)}/my-appointments.html" style="display:inline-block;background:#c66a3a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Rate your visit</a></p>` : '';
  return shell(`
<div style="display:inline-block;background:${s.color};color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px">${esc(s.title)}</div>
<p style="color:#16244a;font-size:16px;margin:18px 0 6px">Hi ${esc(d.name || 'Guest')},</p>
<p style="color:#4a5268;font-size:15px;line-height:1.55;margin:0 0 14px">${esc(s.lead)}</p>
${note}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee4d6;border-bottom:1px solid #eee4d6;margin:12px 0">${detailRows(d)}</table>
${QR_KINDS[kind] ? `<div style="text-align:center;margin:20px 0 6px"><img src="${qr}" width="170" height="170" alt="QR code ${esc(d.ref)}" style="border:1px solid #eee4d6;border-radius:10px"><div style="color:#7a8194;font-size:12px;margin-top:6px">Show this QR code at the front desk</div></div>` : ''}
${link}
<p style="color:#7a8194;font-size:13px;line-height:1.5;margin:18px 0 0">Questions? Call us at ${PHONE} (24 hours) or reply to this email.</p>`);
}

/* short internal alert for the hotel staff */
function buildAlertHtml(title, d, site, lines) {
  const extra = (lines || []).map(l => `<p style="color:#4a5268;font-size:14px;line-height:1.5;margin:0 0 8px">${l}</p>`).join('');
  return shell(`
<div style="display:inline-block;background:#16244a;color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px">${esc(title)}</div>
${d && d.ref ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee4d6;border-bottom:1px solid #eee4d6;margin:16px 0">${detailRows(d)}${d.name ? `<tr><td style="padding:8px 0;color:#7a8194;font-size:12px;letter-spacing:1px;text-transform:uppercase;width:110px">Guest</td><td style="padding:8px 0;color:#16244a;font-size:15px;font-weight:600">${esc(d.name)}</td></tr>` : ''}</table>` : ''}
${extra}
<p style="text-align:center;margin:18px 0 0"><a href="${esc(site)}/admin.html${d && d.ref ? '?ref=' + encodeURIComponent(d.ref) : ''}" style="display:inline-block;background:#c66a3a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Open dashboard</a></p>`);
}

async function sendBrevo({to, name, subject, html}) {
  const key = process.env.BREVO_API_KEY, sender = process.env.SENDER_EMAIL;
  if (!key || !sender) return {ok:false, status:500, text:'Email is not set up yet on the server (add BREVO_API_KEY and SENDER_EMAIL in Vercel).'};
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: {'api-key': key, 'Content-Type': 'application/json', accept: 'application/json'},
    body: JSON.stringify({sender: {name: HOTEL, email: sender}, to: [{email: to, name: name || undefined}], subject, htmlContent: html})});
  return {ok: r.ok, status: r.status, text: r.ok ? '' : await r.text().catch(() => '')};
}

module.exports = {HOTEL, PHONE, esc, clip, fmtDate, fmtTime, STATUS, buildHtml, buildAlertHtml, sendBrevo};
