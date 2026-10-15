/* Verifies a Firebase ID token with Google's public lookup endpoint. */
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA-Po8Edgg5uTlq4MUosj94OBcSjUB_Das';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();

async function whoIs(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return {error: 'Not signed in.', status: 401};
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken: token})});
    if (!r.ok) return {error: 'Session expired. Please log in again.', status: 401};
    const u = ((await r.json()).users || [])[0];
    if (!u || !u.email) return {error: 'Not signed in.', status: 401};
    const email = u.email.toLowerCase();
    return {email, uid: u.localId, emailVerified: !!u.emailVerified, isAdmin: email === ADMIN_EMAIL};
  } catch (e) { return {error: 'Could not verify your session.', status: 502}; }
}
function body(req) { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }
module.exports = {whoIs, body, ADMIN_EMAIL};
