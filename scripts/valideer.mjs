// Controleert nhg-rentes.json vóór elke commit. Geen dependencies (Node 18+).
//
//   node scripts/valideer.mjs                         controleert nhg-rentes.json
//   node scripts/valideer.mjs bestand.json            controleert een ander bestand
//   node scripts/valideer.mjs nieuw.json --vorige oud.json
//                                                     controleert ook de sprong t.o.v. de vorige versie
//
// Exitcode 0 = in orde, 1 = fout gevonden (dan niet committen; de vorige versie blijft online).
import { readFileSync } from "node:fs";

const PERIODES = [5, 10, 20, 30];
const MIN_RENTE = 1.0;
const MAX_RENTE = 10.0;
const MIN_AANBIEDERS = 8; // per periode minimaal zoveel geldverstrekkers geraadpleegd
const MAX_SPRONG = 0.25; // procentpunt t.o.v. de vorige dag
const MAX_LEEFTIJD_BRON = 31; // dagen: oudere ingangsdatum van een rente = verouderde bron

const args = process.argv.slice(2);
const vorigeIdx = args.indexOf("--vorige");
const vorigePad = vorigeIdx >= 0 ? args[vorigeIdx + 1] : null;
const pad = args.find((a, i) => !a.startsWith("--") && !(vorigeIdx >= 0 && i === vorigeIdx + 1)) || "nhg-rentes.json";

const fouten = [];
const fout = (m) => fouten.push(m);

function lees(p) {
  let tekst;
  try {
    tekst = readFileSync(p, "utf8").replace(/^﻿/, ""); // BOM van bijv. Windows-editors negeren
  } catch (e) {
    console.error(`FOUT: kan ${p} niet lezen (${e.message})`);
    process.exit(1);
  }
  try {
    return JSON.parse(tekst);
  } catch (e) {
    console.error(`FOUT: ${p} is geen geldige JSON (${e.message})`);
    process.exit(1);
  }
}

function geldigeDatum(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

const vandaag = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const dagen = (a, b) => Math.round((a - b) / 86400000);
const isRente = (x) => typeof x === "number" && Number.isFinite(x) && x >= MIN_RENTE && x <= MAX_RENTE;

const data = lees(pad);

for (const veld of ["peildatum", "bijgewerkt_op", "voorbeeld", "type", "methode", "periodes", "disclaimer"]) {
  if (!(veld in data)) fout(`verplicht veld ontbreekt: ${veld}`);
}
if (typeof data.voorbeeld !== "boolean") fout("'voorbeeld' moet true of false zijn");
if (typeof data.disclaimer !== "string" || data.disclaimer.trim().length < 20) fout("'disclaimer' ontbreekt of is te kort");

const peildatum = geldigeDatum(data.peildatum);
if (!peildatum) fout(`'peildatum' is geen geldige datum (jjjj-mm-dd): ${data.peildatum}`);
else if (peildatum > vandaag) fout(`'peildatum' ligt in de toekomst: ${data.peildatum}`);
if (Number.isNaN(Date.parse(data.bijgewerkt_op))) fout(`'bijgewerkt_op' is geen geldig tijdstip: ${data.bijgewerkt_op}`);

if (!Array.isArray(data.periodes)) {
  fout("'periodes' moet een lijst zijn");
} else {
  const gezien = data.periodes.map((p) => p && p.jaren);
  for (const j of PERIODES) {
    const n = gezien.filter((x) => x === j).length;
    if (n === 0) fout(`periode ${j} jaar ontbreekt`);
    if (n > 1) fout(`periode ${j} jaar komt ${n} keer voor`);
  }
  for (const x of gezien) if (!PERIODES.includes(x)) fout(`onbekende periode: ${x}`);

  for (const p of data.periodes) {
    if (!p || !PERIODES.includes(p.jaren)) continue;
    const t = `${p.jaren} jaar`;
    if (!isRente(p.gemiddelde)) fout(`${t}: gemiddelde ${p.gemiddelde} ligt niet tussen ${MIN_RENTE} en ${MAX_RENTE}%`);
    if (!Number.isInteger(p.aantal_aanbieders) || p.aantal_aanbieders < MIN_AANBIEDERS)
      fout(`${t}: te weinig geldverstrekkers (${p.aantal_aanbieders}, minimaal ${MIN_AANBIEDERS})`);

    const vijf = p.laagste_vijf;
    if (!Array.isArray(vijf) || vijf.length !== 5) {
      fout(`${t}: 'laagste_vijf' moet precies 5 rentes bevatten`);
      continue;
    }
    const namen = new Set();
    vijf.forEach((r, i) => {
      const w = `${t}, nr. ${i + 1}`;
      if (!r || typeof r.aanbieder !== "string" || !r.aanbieder.trim()) fout(`${w}: aanbieder ontbreekt`);
      else if (namen.has(r.aanbieder)) fout(`${w}: ${r.aanbieder} staat dubbel in de laagste vijf`);
      else namen.add(r.aanbieder);
      if (!isRente(r?.rente)) fout(`${w}: rente ${r?.rente} ligt niet tussen ${MIN_RENTE} en ${MAX_RENTE}%`);
      let url = null;
      try {
        url = new URL(r?.bron);
      } catch {}
      if (!url || url.protocol !== "https:") fout(`${w}: 'bron' ontbreekt of is geen https-adres`);
      else if (!data.voorbeeld && url.hostname.endsWith("example.org")) fout(`${w}: voorbeeldbron in echte data`);
      const d = geldigeDatum(r?.ingangsdatum);
      if (!d) fout(`${w}: 'ingangsdatum' is geen geldige datum`);
      else if (d > vandaag) fout(`${w}: ingangsdatum ligt in de toekomst`);
      else if (!data.voorbeeld && peildatum && dagen(peildatum, d) > MAX_LEEFTIJD_BRON)
        fout(`${w}: bron is verouderd (ingangsdatum ${r.ingangsdatum})`);
    });
    if (vijf.every((r) => isRente(r?.rente))) {
      for (let i = 1; i < 5; i++) if (vijf[i].rente < vijf[i - 1].rente) fout(`${t}: 'laagste_vijf' staat niet van laag naar hoog`);
      const gem = Math.round((vijf.reduce((s, r) => s + r.rente, 0) / 5) * 100) / 100;
      if (Math.abs(gem - p.gemiddelde) > 0.005) fout(`${t}: gemiddelde ${p.gemiddelde} klopt niet met de vijf rentes (${gem})`);
    }
  }
}

if (vorigePad && !data.voorbeeld) {
  const vorige = lees(vorigePad);
  if (!vorige.voorbeeld && Array.isArray(vorige.periodes)) {
    for (const p of data.periodes || []) {
      const v = vorige.periodes.find((x) => x && x.jaren === p.jaren);
      if (v && isRente(v.gemiddelde) && isRente(p.gemiddelde) && Math.abs(p.gemiddelde - v.gemiddelde) > MAX_SPRONG)
        fout(`${p.jaren} jaar: gemiddelde sprong van ${v.gemiddelde}% naar ${p.gemiddelde}% (meer dan ${MAX_SPRONG} procentpunt)`);
    }
  }
}

if (fouten.length) {
  console.error(`${pad}: ${fouten.length} fout(en) gevonden:`);
  for (const f of fouten) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${pad}: in orde${data.voorbeeld ? " (voorbeelddata)" : ""}.`);
