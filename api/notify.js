/* Vercel serverless function: sends appointment emails through Brevo.
   POST /api/notify   Authorization: Bearer <Firebase ID token>
   - type "received" | "rescheduled" | "guestcancel": the signed-in guest gets an email (always to their own
     verified address) and the hotel gets an alert email.
   - type "status": ONLY the admin; emails the guest when a booking is confirmed / declined / completed.
   Environment variables (Vercel > Project > Settings > Environment Variables):
     BREVO_API_KEY, SENDER_EMAIL           required
     SITE_URL                              optional, e.g. https://baihotel-app.vercel.app
     ADMIN_ALERT_EMAIL                     optional, where staff alerts go (defaults to SENDER_EMAIL)
     ADMIN_EMAIL                           optional, defaults to admin@gmail.com                    */
const {clip, STATUS, buildHtml, buildAlertHtml, sendBrevo} = require('./_mail');
const {whoIs, body} = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error: 'POST only'});
  if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) return res.status(500).json({error: 'Email is not set up yet on the server (add BREVO_API_KEY and SENDER_EMAIL in Vercel).'});

  const who = await whoIs(req);
  if (who.error) return res.status(who.status).json({error: who.error});
  const b = body(req);
  const d = {ref: clip(b.ref, 20).replace(/[^A-Za-z0-9-]/g, ''), name: clip(b.name, 100), service: clip(b.service, 60),
             guests: clip(b.guests, 4), apptDate: clip(b.apptDate, 10), apptTime: clip(b.apptTime, 5)};
  if (!d.ref) return res.status(400).json({error: 'Missing reference.'});

  let kind, to, extra = '', alert = null;
  if (b.type === 'received' || b.type === 'rescheduled' || b.type === 'guestcancel') {
    if (!who.emailVerified && !who.isAdmin) return res.status(403).json({error: 'Email not verified.'});
    kind = b.type === 'guestcancel' ? 'selfcancel' : b.type; to = who.email;     // always the guest's own verified address
    alert = {received: 'New appointment', rescheduled: 'Appointment rescheduled', selfcancel: 'Guest cancelled'}[kind];
  } else if (b.type === 'status') {
    if (!who.isAdmin) return res.status(403).json({error: 'Admins only.'});
    kind = String(b.status);
    if (!['confirmed', 'cancelled', 'completed'].includes(kind)) return res.status(400).json({error: 'This status is not emailed.'});
    to = clip(b.to, 200).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({error: 'Guest email looks invalid.'});
    extra = clip(b.message, 500);
  } else return res.status(400).json({error: 'Unknown type.'});

  const site = (process.env.SITE_URL || req.headers.origin || ('https://' + req.headers.host)).replace(/\/$/, '');
  try {
    const r = await sendBrevo({to, name: d.name, subject: STATUS[kind].subject + ' (' + d.ref + ')', html: buildHtml(kind, d, site, extra)});
    if (!r.ok) { console.error('Brevo', r.status, r.text); return res.status(502).json({error: 'The email service refused the message (' + r.status + '). Check the Brevo key and verified sender.'}); }
    if (alert) {   // staff alert: best effort, never blocks the guest's email
      const staff = process.env.ADMIN_ALERT_EMAIL || process.env.SENDER_EMAIL;
      sendBrevo({to: staff, subject: alert + ': ' + d.ref, html: buildAlertHtml(alert, d, site, ['Guest account: ' + who.email])}).catch(() => {});
    }
    return res.status(200).json({ok: true});
  } catch (e) { console.error(e); return res.status(502).json({error: 'Could not reach the email service.'}); }
};
