// Urmărește cronometrul din aplicație (timer.json pe ramura date) și trimite notificarea cu sunet când se termină pauza.
// Pornește în fundal lângă bucla de mementouri; verifică la 2 secunde (cererile 304 nu consumă din limita GitHub).
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';

const dir = process.argv[2] || '.', until = Date.now() + (+process.argv[3] || 20600) * 1000;
const keys = JSON.parse(process.env.FORTA_KEYS || '{}'), repo = process.env.REPO, tok = process.env.GH_TOKEN;
function decrypt(enc) {
  const aes = crypto.privateDecrypt({ key: keys.rsaPrivate, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(enc.k, 'base64'));
  const buf = Buffer.from(enc.d, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', aes, Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
}
let sub = null;
function loadSub() { try { sub = decrypt(JSON.parse(fs.readFileSync(`${dir}/config.enc.json`, 'utf8'))).sub; } catch (e) { } }
loadSub();
webpush.setVapidDetails('https://github.com/CristianDemian/forta', keys.vapidPublic, keys.vapidPrivate);
let etag = '', timer = null, sentId = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
while (Date.now() < until) {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/timer.json?ref=date`, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github.raw+json', ...(etag ? { 'If-None-Match': etag } : {}) } });
    if (r.status === 200) { etag = r.headers.get('etag') || ''; timer = await r.json(); }
    else if (r.status === 404) timer = null;
  } catch (e) { }
  if (timer && timer.end && timer.id !== sentId && Date.now() >= timer.end - 1500 && Date.now() - timer.end < 120000) {
    sentId = timer.id;
    if (!sub) loadSub();
    try { await webpush.sendNotification(sub, JSON.stringify({ title: timer.title || '⏱ Pauza s-a terminat', body: timer.body || 'Treci la treabă!', tag: 'timer' }), { TTL: 120, urgency: 'high' }); console.log('Cronometru trimis', timer.id); }
    catch (e) { console.log('Eroare cronometru', e.statusCode); }
  }
  if (++n % 900 === 0) loadSub();
  await sleep(2000);
}
