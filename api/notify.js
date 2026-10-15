/* Vercel serverless function: sends appointment emails through Brevo.
   POST /api/notify   Authorization: Bearer <Firebase ID token>
   - type "received" / "rescheduled": the signed-in guest gets their receipt (sent only to the verified email of that account).
   - type "status":   ONLY the admin can use it; emails the guest when a booking is confirmed / declined / completed.
   Environment variables (Vercel > Project > Settings > Environment Variables):
     BREVO_API_KEY   your Brevo API key (v3)
     SENDER_EMAIL    a sender address verified in Brevo (Senders & IP)
     SITE_URL        optional, e.g. https://baihotel-app.vercel.app  (used for the QR code link)
     ADMIN_EMAIL     optional, defaults to admin@gmail.com                                            */
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA-Po8Edgg5uTlq4MUosj94OBcSjUB_Das';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
const HOTEL = 'bai Hotel Cebu';
const PHONE = '+63 (032) 342 8888';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const fmtDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-PH', {timeZone:'UTC', weekday:'long', month:'long', day:'numeric', year:'numeric'}) : '';
const fmtTime = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = +m[1]; return ((h % 12) || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM'); };

const STATUS = {
  received:  {subject:'We received your appointment request', title:'Request received', color:'#c66a3a',
              lead:'Thank you! Your request is now with our concierge team. We will email you again as soon as it is confirmed or declined.'},
  rescheduled: {subject:'We received your new schedule', title:'Reschedule received', color:'#c66a3a',
              lead:'Your appointment has been moved to the new date and time below. It is pending again, and we will email you as soon as the hotel confirms it.'},
  confirmed: {subject:'Your appointment is confirmed', title:'Appointment confirmed', color:'#2e9e6b',
              lead:'Good news! Your appointment is confirmed. We look forward to welcoming you at bai Hotel Cebu.'},
  cancelled: {subject:'Update on your appointment request', title:'Appointment declined', color:'#c93a3a',
              lead:'We are sorry, but we are unable to accommodate this appointment. You are welcome to book another date or time, or call us and we will gladly help.'},
  completed: {subject:'Thank you for visiting bai Hotel Cebu', title:'Thank you for your visit', color:'#3987e5',
              lead:'Thank you for choosing bai Hotel Cebu. We hope you enjoyed your visit and hope to see you again soon.'}
};

function buildHtml(kind, d, site, extraMsg) {
  const s = STATUS[kind];
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(site + '/admin.html?ref=' + d.ref);
  const rows = [['Reference', d.ref], ['Service', d.service], ['Date', fmtDate(d.apptDate)], ['Time', fmtTime(d.apptTime)], ['Guests', d.guests]]
    .filter(r => r[1]).map(r => `<tr><td style="padding:8px 0;color:#7a8194;font-size:12px;letter-spacing:1px;text-transform:uppercase;width:110px">${esc(r[0])}</td><td style="padding:8px 0;color:#16244a;font-size:15px;font-weight:600">${esc(r[1])}</td></tr>`).join('');
  const note = extraMsg ? `<div style="margin:18px 0;padding:14px 16px;background:#fff7ef;border-left:4px solid #c66a3a;border-radius:6px;color:#16244a;font-size:14px;line-height:1.5"><b>Message from the hotel</b><br>${esc(extraMsg).replace(/\n/g, '<br>')}</div>` : '';
  const showQr = kind === 'received' || kind === 'confirmed' || kind === 'rescheduled';
  return `<!doctype html><html><body style="margin:0;background:#f1ece3;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#c66a3a;padding:26px 28px;color:#fff"><div style="font-family:Georgia,serif;font-size:28px;font-weight:600">bai Hotel</div><div style="font-size:12px;letter-spacing:3px;margin-top:4px">CEBU &middot; MANDAUE</div></td></tr>
<tr><td style="padding:28px">
<div style="display:inline-block;background:${s.color};color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px">${esc(s.title)}</div>
<p style="color:#16244a;font-size:16px;margin:18px 0 6px">Hi ${esc(d.name || 'Guest')},</p>
<p style="color:#4a5268;font-size:15px;line-height:1.55;margin:0 0 14px">${esc(s.lead)}</p>
${note}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee4d6;border-bottom:1px solid #eee4d6;margin:12px 0">${rows}</table>
${showQr ? `<div style="text-align:center;margin:20px 0 6px"><img src="${qr}" width="170" height="170" alt="QR code ${esc(d.ref)}" style="border:1px solid #eee4d6;border-radius:10px"><div style="color:#7a8194;font-size:12px;margin-top:6px">Show this QR code at the front desk</div></div>` : ''}
<p style="color:#7a8194;font-size:13px;line-height:1.5;margin:18px 0 0">Questions? Call us at ${PHONE} (24 hours) or reply to this email.</p>
</td></tr>
<tr><td style="background:#16244a;color:#b6bfd1;font-size:12px;text-align:center;padding:16px">${HOTEL} &middot; This is an automated message about your booking.</td></tr>
</table></td></tr></table></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error: 'POST only'});
  const key = process.env.BREVO_API_KEY, sender = process.env.SENDER_EMAIL;
  if (!key || !sender) return res.status(500).json({error: 'Email is not set up yet on the server (add BREVO_API_KEY and SENDER_EMAIL in Vercel).'});

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({error: 'Not signed in.'});
  let who;
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken: token})});
    if (!r.ok) return res.status(401).json({error: 'Session expired. Please log in again.'});
    who = ((await r.json()).users || [])[0];
  } catch (e) { return res.status(502).json({error: 'Could not verify your session.'}); }
  if (!who || !who.email) return res.status(401).json({error: 'Not signed in.'});
  const email = who.email.toLowerCase(), isAdmin = email === ADMIN_EMAIL;

  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  const d = {ref: clip(b.ref, 20).replace(/[^A-Za-z0-9-]/g, ''), name: clip(b.name, 100), service: clip(b.service, 60),
             guests: clip(b.guests, 4), apptDate: clip(b.apptDate, 10), apptTime: clip(b.apptTime, 5)};
  if (!d.ref) return res.status(400).json({error: 'Missing reference.'});

  let kind, to, extra = '';
  if (b.type === 'received' || b.type === 'rescheduled') {
    if (!who.emailVerified && !isAdmin) return res.status(403).json({error: 'Email not verified.'});
    kind = b.type; to = email;                       // always the signed-in guest's own verified address
  } else if (b.type === 'status') {
    if (!isAdmin) return res.status(403).json({error: 'Admins only.'});
    kind = String(b.status);
    if (!STATUS[kind] || kind === 'received' || kind === 'rescheduled') return res.status(400).json({error: 'This status is not emailed.'});
    to = clip(b.to, 200).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({error: 'Guest email looks invalid.'});
    extra = clip(b.message, 500);
  } else return res.status(400).json({error: 'Unknown type.'});

  const site = (process.env.SITE_URL || req.headers.origin || ('https://' + req.headers.host)).replace(/\/$/, '');
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: {'api-key': key, 'Content-Type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({sender: {name: HOTEL, email: sender}, to: [{email: to, name: d.name || undefined}],
        subject: STATUS[kind].subject + ' (' + d.ref + ')', htmlContent: buildHtml(kind, d, site, extra)})});
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('Brevo', r.status, t); return res.status(502).json({error: 'The email service refused the message (' + r.status + '). Check the Brevo key and verified sender.'}); }
    return res.status(200).json({ok: true});
  } catch (e) { console.error(e); return res.status(502).json({error: 'Could not reach the email service.'}); }
};
