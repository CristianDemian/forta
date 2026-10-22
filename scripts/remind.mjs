// Trimite mementourile pentru suplimente. Rulează pe GitHub în fiecare minut.
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';

const dir = process.argv[2] || 'data';
const keys = JSON.parse(process.env.FORTA_KEYS || '{}');
const test = process.env.TEST === '1';
const cfgPath = `${dir}/config.enc.json`, statePath = `${dir}/state.json`;
if (!fs.existsSync(cfgPath)) { console.log('Nu există încă o listă de suplimente.'); process.exit(0); }

function decrypt(enc) {
  const aes = crypto.privateDecrypt({ key: keys.rsaPrivate, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(enc.k, 'base64'));
  const buf = Buffer.from(enc.d, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', aes, Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
}
const cfg = decrypt(JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { sent: {} };

const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz || 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${parts.year}-${parts.month}-${parts.day}`, nowMin = +parts.hour * 60 + +parts.minute;

webpush.setVapidDetails('https://github.com/CristianDemian/forta', keys.vapidPublic, keys.vapidPrivate);
async function send(title, body, tag) {
  try { await webpush.sendNotification(cfg.sub, JSON.stringify({ title, body, tag }), { TTL: 3600, urgency: 'high' }); console.log('Trimis:', tag); return true; }
  catch (e) { console.log('Eroare la trimitere:', e.statusCode, e.body); if (e.statusCode === 404 || e.statusCode === 410) state.expired = true; return false; }
}

if (test) {
  await send('Forța: test reușit', 'Notificările funcționează. Primești mementouri la ora fiecărui supliment.', 'test');
} else {
  const sent = state.sent[today] || [];
  const due = {};
  for (const s of cfg.supps || []) {
    const [h, m] = s.time.split(':').map(Number), t = h * 60 + m, key = `${s.id}@${s.time}`;
    if (t <= nowMin && nowMin - t <= 30 && !sent.includes(key)) (due[s.time] = due[s.time] || []).push({ s, key });
  }
  for (const time of Object.keys(due).sort()) {
    const list = due[time];
    const supp = list.filter(x => !x.s.water), water = list.some(x => x.s.water);
    let title, body;
    if (!supp.length) { title = '💧 Bea un pahar cu apă'; body = `Paharul de la ${time}. Hidratarea ajută forța și recuperarea.`; }
    else {
      title = supp.length === 1 ? `E ora pentru ${supp[0].s.name}` : `Suplimentele de la ${time}`;
      body = supp.map(x => `${x.s.name}: ${x.s.dose}`).join('\n') + (water ? '\n💧 Și un pahar cu apă.' : '');
    }
    if (await send(title, body, 'supl-' + time)) sent.push(...list.map(x => x.key));
  }
  state.sent = { [today]: sent };
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
