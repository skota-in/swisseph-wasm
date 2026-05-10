/**
 * Node example: compute planet positions and ayanamsa for a given chart.
 *
 * Run after building:
 *   npm run build
 *   node examples/node-example.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Astrosk, SE } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const ephe = join(here, '..', 'deps', 'ephe');

const astrosk = await Astrosk.init();

// Load minimal ephemeris into the WASM virtual FS
for (const name of ['sepl_18.se1', 'semo_18.se1', 'seleapsec.txt', 'sefstars.txt', 'seorbel.txt']) {
  const bytes = await readFile(join(ephe, name));
  astrosk.loadEphemerisFile(name, new Uint8Array(bytes));
}

// May 10, 2026 7:32:26 EDT (= 11:32:26 UT)
const jd = astrosk.julday(2026, 5, 10, 11 + 32 / 60 + 26 / 3600);
console.log('Julian Day:', jd.toFixed(9));
console.log('Delta T:', astrosk.deltaT(jd).toFixed(3), 's');

console.log('\n--- Tropical (default) ---');
const planets = ['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO'];
for (const name of planets) {
  const r = astrosk.calcUt(jd, SE[name], SE.FLG.SWIEPH | SE.FLG.SPEED);
  console.log(
    `${name.padEnd(8)} lon=${r.longitude.toFixed(4).padStart(9)}°  ` +
    `lat=${r.latitude.toFixed(4).padStart(8)}°  ` +
    `dist=${r.distance.toFixed(4)} AU  ` +
    `speed=${r.longitudeSpeed.toFixed(4)}°/d`,
  );
}

console.log('\n--- Sidereal True Pushya (PVR Narasimha Rao) ---');
astrosk.setSidMode(SE.SIDM.TRUE_PUSHYA);
const ayan = astrosk.getAyanamsaUt(jd);
console.log(`Ayanamsa: ${ayan.toFixed(6)}°`);
for (const name of planets) {
  const r = astrosk.calcUt(jd, SE[name], SE.FLG.SWIEPH | SE.FLG.SIDEREAL | SE.FLG.SPEED);
  console.log(`${name.padEnd(8)} ${r.longitude.toFixed(4).padStart(9)}°`);
}

console.log('\n--- Houses Placidus (South Grafton, MA) ---');
const lat = 42 + 12 / 60 + 10 / 3600;
const lon = -(71 + 41 / 60 + 10 / 3600);
const houses = astrosk.houses(jd, lat, lon, 'P');
console.log(`Ascendant: ${houses.ascmc[0].toFixed(4)}°`);
console.log(`MC:        ${houses.ascmc[1].toFixed(4)}°`);
console.log(`ARMC:      ${houses.ascmc[2].toFixed(4)}°`);
for (let i = 1; i <= 12; i++) {
  console.log(`  House ${String(i).padStart(2)}: ${houses.cusps[i].toFixed(4)}°`);
}

astrosk.close();
