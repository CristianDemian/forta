// Ia calendarul și rezultatele lui Dinamo de pe lpf.ro și le scrie în matches.json
import fs from 'node:fs';
const dir = process.argv[2] || 'data';
const NAMES = { CFR: 'CFR 1907 Cluj', UTA: 'UTA Arad', FCA: 'FC Argeș', FCP: 'Petrolul Ploiești', UCV: 'Universitatea Craiova', OGL: 'Oțelul Galați', FCV: 'FC Voluntari',
  RAP: 'Rapid București', UCJ: 'Universitatea Cluj', COR: 'Corvinul Hunedoara', FCSB: 'FCSB', FKCS: 'FK Csíkszereda', FAR: 'Farul Constanța', OSK: 'Sepsi OSK', FCB: 'FC Botoșani',
  MET: 'Metaloglobus', HER: 'Hermannstadt', UNI: 'Unirea Slobozia', GLO: 'Gloria Buzău' };
const MON = { ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6, iulie: 7, august: 8, septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12 };
const txt = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function parse(html) {
  return html.split('class="meci-card').slice(1).map(b => {
    const loc = /meci-locatie"><span>([^<]*)<\/span>([^<]*)/.exec(b), date = /meci-date"><span>([^<]*)/.exec(b), ora = /meci-ora">([^<]*)/.exec(b);
    const c1 = /echipa1-text">([^<]*)/.exec(b), c2 = /echipa2-text">([^<]*)/.exec(b), sc = [...b.matchAll(/scor-goluri">\s*(\d+)/g)].map(m => +m[1]);
    const comp = /meci-etapa">([^<]*)<div[^>]*>([^<]*)/.exec(b);
    if (!loc || !date || !c1 || !c2) return null;
    const [d, mo, y] = txt(date[1]).split(' '); if (!MON[mo]) return null;
    const home = /acas/i.test(loc[1]), oppCode = home ? txt(c2[1]) : txt(c1[1]);
    const opp = NAMES[oppCode] || (home ? oppCode : txt(loc[2]));
    const t = txt(ora && ora[1]);
    const m = { date: `${y}-${String(MON[mo]).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time: /^\d\d:\d\d$/.test(t) ? t : '', opp, home, round: txt(comp && comp[1]), comp: txt(comp && comp[2]) };
    if (sc.length === 2) { m.us = home ? sc[0] : sc[1]; m.them = home ? sc[1] : sc[0]; }
    return m;
  }).filter(Boolean);
}
const get = async u => { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (forta)' } }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.text(); };
try {
  const [cal, rez] = await Promise.all([get('https://lpf.ro/cluburi/dinamo-bucuresti/14/calendar'), get('https://lpf.ro/cluburi/dinamo-bucuresti/14/rezultate')]);
  const next = parse(cal).filter(m => m.us == null).sort((a, b) => a.date.localeCompare(b.date));
  const last = parse(rez).filter(m => m.us != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (!next.length && !last.length) throw new Error('Nu am găsit meciuri în pagină.');
  const out = { updated: new Date().toISOString(), next, last };
  const p = `${dir}/matches.json`, old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const same = old && JSON.stringify({ ...JSON.parse(old), updated: 0 }) === JSON.stringify({ ...out, updated: 0 });
  if (!same) fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('Meciuri:', next.length, 'viitoare,', last.length, 'jucate', same ? '(neschimbat)' : '(actualizat)');
} catch (e) { console.log('Eroare la meciuri:', e.message); }
