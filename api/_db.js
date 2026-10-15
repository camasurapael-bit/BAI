/* Optional server-side Firestore access (firebase-admin). Needs the env var FIREBASE_SERVICE_ACCOUNT
   (the whole service-account JSON). Returns null when it is not configured. */
let db = null;
function getDb() {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp({credential: admin.credential.cert(JSON.parse(raw))});
  db = admin.firestore();
  return db;
}
module.exports = {getDb};
