/* POST /api/slot  {service, date, time, exceptId?}  Authorization: Bearer <Firebase ID token>
   Checks the per-time-slot capacity set by the admin (settings/availability.capacity; 0 = unlimited).
   Answers {ok:true} when full-checking is not configured, so booking never breaks because of it. */
const {whoIs, body} = require('./_auth');
const {getDb} = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error: 'POST only'});
  const who = await whoIs(req);
  if (who.error) return res.status(who.status).json({error: who.error});
  const b = body(req), service = String(b.service || '').slice(0, 60), date = String(b.date || ''), time = String(b.time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({error: 'Bad date or time.'});
  let db;
  try { db = getDb(); } catch (e) { console.error(e); db = null; }
  if (!db) return res.status(200).json({ok: true, checked: false});
  try {
    const s = await db.collection('settings').doc('availability').get();
    const cfg = s.exists ? s.data() : {};
    if (Array.isArray(cfg.blockedDates) && cfg.blockedDates.includes(date)) return res.status(200).json({ok: false, reason: 'closed'});
    const cap = parseInt(cfg.capacity, 10) || 0;
    if (!cap) return res.status(200).json({ok: true, checked: true});
    const snap = await db.collection('appointments').where('apptDate', '==', date).where('apptTime', '==', time).get();
    const n = snap.docs.filter(d => { const x = d.data(); return x.service === service && (x.status || 'pending') !== 'cancelled' && d.id !== b.exceptId; }).length;
    return res.status(200).json({ok: n < cap, reason: n < cap ? '' : 'full', left: Math.max(0, cap - n)});
  } catch (e) { console.error(e); return res.status(200).json({ok: true, checked: false}); }
};
