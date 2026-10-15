/* Daily job (Vercel Cron, see vercel.json): 
   1) emails a reminder to guests whose CONFIRMED appointment is tomorrow (Philippine time),
   2) emails the hotel a short daily summary.
   Needs FIREBASE_SERVICE_ACCOUNT (service-account JSON), BREVO_API_KEY, SENDER_EMAIL.
   Optional CRON_SECRET: when set in Vercel, Vercel sends it automatically and other callers are refused. */
const {STATUS, buildHtml, buildAlertHtml, sendBrevo, esc} = require('./_mail');
const {getDb} = require('./_db');

const manila = offsetDays => new Date(Date.now() + 8 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).json({error: 'Unauthorized'});
  let db;
  try { db = getDb(); } catch (e) { console.error(e); return res.status(500).json({error: 'FIREBASE_SERVICE_ACCOUNT is not valid JSON.'}); }
  if (!db) return res.status(500).json({error: 'FIREBASE_SERVICE_ACCOUNT is not set.'});
  const site = (process.env.SITE_URL || ('https://' + req.headers.host)).replace(/\/$/, '');
  const today = manila(0), tomorrow = manila(1);
  try {
    const live = a => (a.status || 'pending') !== 'cancelled';
    const [tm, td] = await Promise.all([db.collection('appointments').where('apptDate', '==', tomorrow).get(), db.collection('appointments').where('apptDate', '==', today).get()]);
    let sent = 0, failed = 0;
    for (const doc of tm.docs) {
      const a = doc.data();
      if ((a.status || 'pending') !== 'confirmed' || a.reminderSent || !a.email) continue;
      const d = {ref: a.refCode, name: a.fullName, service: a.service, guests: a.guests, apptDate: a.apptDate, apptTime: a.apptTime};
      const r = await sendBrevo({to: a.email, name: a.fullName, subject: STATUS.reminder.subject + ' (' + a.refCode + ')', html: buildHtml('reminder', d, site, '')});
      if (r.ok) { await doc.ref.update({reminderSent: true}); sent++; } else { failed++; console.error('reminder', a.refCode, r.status, r.text); }
    }
    const staff = process.env.ADMIN_ALERT_EMAIL || process.env.SENDER_EMAIL;
    const dayList = (docs) => docs.map(x => x.data()).filter(live).sort((p, q) => String(p.apptTime).localeCompare(String(q.apptTime)));
    const line = a => `${esc(a.apptTime)} &middot; ${esc(a.service)} &middot; ${esc(a.fullName)} (${esc(a.guests)} guests, ${esc(a.status || 'pending')})`;
    const T = dayList(td.docs), N = dayList(tm.docs);
    if (staff) await sendBrevo({to: staff, subject: `Daily summary: ${T.length} today, ${N.length} tomorrow`, html: buildAlertHtml('Daily summary', null, site, [
      `<b>Today (${today}): ${T.length}</b><br>${T.map(line).join('<br>') || 'No appointments.'}`,
      `<b>Tomorrow (${tomorrow}): ${N.length}</b><br>${N.map(line).join('<br>') || 'No appointments.'}`,
      `Reminders sent: ${sent}${failed ? ' (failed: ' + failed + ')' : ''}.`])});
    return res.status(200).json({ok: true, sent, failed, today: T.length, tomorrow: N.length});
  } catch (e) { console.error(e); return res.status(500).json({error: 'Cron failed: ' + e.message}); }
};
