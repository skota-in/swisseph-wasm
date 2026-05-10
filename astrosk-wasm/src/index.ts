/**
 * astrosk-wasm public entry point.
 *
 * Usage (Angular / browser):
 *
 *   import { Astrosk, SE } from 'astrosk-wasm';
 *
 *   const astrosk = await Astrosk.init({ ephePath: '/ephe' });
 *
 *   // Optional: load an ephemeris file from your assets
 *   const buf = await fetch('/assets/ephe/sepl_18.se1')
 *     .then(r => r.arrayBuffer());
 *   astrosk.loadEphemerisFile('sepl_18.se1', new Uint8Array(buf));
 *
 *   const jd = astrosk.julday(2026, 5, 10, 11.540556);
 *   const sun = astrosk.calcUt(jd, SE.SUN, SE.FLG.SWIEPH | SE.FLG.SPEED);
 *   console.log('Sun longitude:', sun.longitude);
 *
 *   // Sidereal (Vedic) mode
 *   astrosk.setSidMode(SE.SIDM.LAHIRI);
 *   const sunSidereal = astrosk.calcUt(
 *     jd, SE.SUN, SE.FLG.SWIEPH | SE.FLG.SIDEREAL | SE.FLG.SPEED,
 *   );
 *
 *   astrosk.close();
 */

export { Astrosk } from './astrosk.js';
export { SE } from './constants.js';
export type {
  CalcFlags,
  HouseSystem,
  Planet,
  SidMode,
} from './constants.js';
export type {
  AstroskInitOptions,
  CalcResult,
  HousesResult,
  JdConversion,
  RevjulResult,
  UtcDate,
} from './types.js';
