/**
 * Astrosk - main API class. Thin TypeScript wrapper over Swiss Ephemeris
 * compiled to WebAssembly.
 *
 * Memory access pattern (IMPORTANT):
 * Heap views are typed arrays with element-sized indices, NOT byte indices.
 *   HEAPF64[i]  reads bytes [i*8, i*8+8)
 *   HEAP32[i]   reads bytes [i*4, i*4+4)
 * To convert a byte pointer (returned by _malloc) to a typed-array index,
 * use unsigned right-shift:
 *   HEAPF64[ptr >>> 3]   // double
 *   HEAP32[ptr >>> 2]    // int32
 * Using `ptr / 8` happens to work for aligned pointers but is float math
 * and triggers de-optimization in some JS engines; `>>> 3` is canonical.
 */

import { loadAstroskModule, type WasmModule } from './loader.js';
import type {
  AstroskInitOptions,
  CalcResult,
  HousesResult,
  JdConversion,
  RevjulResult,
  UtcDate,
} from './types.js';
import { SE, type CalcFlags, type HouseSystem, type Planet, type SidMode } from './constants.js';

const ERR_BUF_SIZE = 256;
const STAR_BUF_SIZE = 256;

export class Astrosk {
  private mod: WasmModule;
  private ephePath: string;
  private closed = false;

  // Reusable scratch buffers. Allocated once at init, freed on close().
  // This avoids per-call malloc/free overhead in the hot path.
  private scratchD6: number; // 6 doubles - planet calc result
  private scratchD13: number; // 13 doubles - houses cusps
  private scratchD8: number;  // 8 doubles - houses ascmc / utc
  private scratchErr: number; // error string buffer
  private scratchStar: number; // fixstar name buffer

  private constructor(mod: WasmModule, ephePath: string) {
    this.mod = mod;
    this.ephePath = ephePath;
    this.scratchD6 = mod._malloc(6 * 8);
    this.scratchD13 = mod._malloc(13 * 8);
    this.scratchD8 = mod._malloc(8 * 8);
    this.scratchErr = mod._malloc(ERR_BUF_SIZE);
    this.scratchStar = mod._malloc(STAR_BUF_SIZE);
  }

  /**
   * Create and initialize an Astrosk instance.
   * Loads the WASM module and configures the ephemeris path.
   */
  static async init(options: AstroskInitOptions = {}): Promise<Astrosk> {
    const mod = await loadAstroskModule(options);
    const ephePath = options.ephePath ?? '/ephe';

    if (!mod.FS.analyzePath(ephePath).exists) {
      try {
        mod.FS.mkdir(ephePath);
      } catch {
        // Already exists or parent missing; FS.mkdir throws on dup.
      }
    }

    const instance = new Astrosk(mod, ephePath);
    if (!options.noEphePath) {
      instance.setEphePath(ephePath);
    }
    return instance;
  }

  // -----------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------

  /** Tell Swiss Ephemeris where to find .se1 files inside the virtual FS. */
  setEphePath(path: string): void {
    this.checkOpen();
    this.callStr('swe_set_ephe_path', path);
    this.ephePath = path;
  }

  /** Set the JPL ephemeris file name (default 'de441.eph' if used). */
  setJplFile(name: string): void {
    this.checkOpen();
    this.callStr('swe_set_jpl_file', name);
  }

  /**
   * Load an ephemeris (.se1 or .eph or text) file into the virtual FS at
   * `${ephePath}/${name}`. Provide the file contents as bytes; this is the
   * recommended way to ship ephemeris in browser apps:
   *
   *   const bytes = await fetch('/assets/ephe/sepl_18.se1')
   *     .then(r => r.arrayBuffer());
   *   astrosk.loadEphemerisFile('sepl_18.se1', new Uint8Array(bytes));
   */
  loadEphemerisFile(name: string, data: Uint8Array): void {
    this.checkOpen();
    const target = `${this.ephePath}/${name}`;
    this.mod.FS.writeFile(target, data);
  }

  /** Set the sidereal mode (ayanamsa). */
  setSidMode(mode: SidMode, t0 = 0, ayan_t0 = 0): void {
    this.checkOpen();
    this.mod.ccall(
      'swe_set_sid_mode',
      null,
      ['number', 'number', 'number'],
      [mode, t0, ayan_t0],
    );
  }

  /** Set topocentric observer location (lon east-positive, lat, altitude m). */
  setTopo(lon: number, lat: number, altitude = 0): void {
    this.checkOpen();
    this.mod.ccall(
      'swe_set_topo',
      null,
      ['number', 'number', 'number'],
      [lon, lat, altitude],
    );
  }

  // -----------------------------------------------------------------
  // Date / time
  // -----------------------------------------------------------------

  /** Convert calendar date+hour to Julian Day. */
  julday(year: number, month: number, day: number, hour: number, gregFlag = SE.GREG_CAL): number {
    this.checkOpen();
    return this.mod.ccall(
      'swe_julday',
      'number',
      ['number', 'number', 'number', 'number', 'number'],
      [year, month, day, hour, gregFlag],
    ) as number;
  }

  /** Convert Julian Day back to year/month/day/hour. */
  revjul(jd: number, gregFlag = SE.GREG_CAL): RevjulResult {
    this.checkOpen();
    const yearPtr = this.mod._malloc(4);
    const monthPtr = this.mod._malloc(4);
    const dayPtr = this.mod._malloc(4);
    const hourPtr = this.mod._malloc(8);
    try {
      this.mod.ccall(
        'swe_revjul',
        null,
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [jd, gregFlag, yearPtr, monthPtr, dayPtr, hourPtr],
      );
      return {
        year: this.mod.HEAP32[yearPtr >>> 2],
        month: this.mod.HEAP32[monthPtr >>> 2],
        day: this.mod.HEAP32[dayPtr >>> 2],
        hour: this.mod.HEAPF64[hourPtr >>> 3],
      };
    } finally {
      this.mod._free(yearPtr);
      this.mod._free(monthPtr);
      this.mod._free(dayPtr);
      this.mod._free(hourPtr);
    }
  }

  /** Convert UTC calendar date to (jd_ut, jd_et). */
  utcToJd(date: UtcDate, gregFlag = SE.GREG_CAL): JdConversion {
    this.checkOpen();
    const dretPtr = this.mod._malloc(2 * 8);
    const errPtr = this.scratchErr;
    try {
      const ret = this.mod.ccall(
        'swe_utc_to_jd',
        'number',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [
          date.year,
          date.month,
          date.day,
          date.hour,
          date.minute,
          date.second,
          gregFlag,
          dretPtr,
          errPtr,
        ],
      ) as number;
      if (ret < 0) {
        throw new Error(`swe_utc_to_jd: ${this.mod.UTF8ToString(errPtr)}`);
      }
      const idx = dretPtr >>> 3;
      return {
        jdEt: this.mod.HEAPF64[idx],
        jdUt: this.mod.HEAPF64[idx + 1],
      };
    } finally {
      this.mod._free(dretPtr);
    }
  }

  /** Delta T (seconds) at a Julian Day. */
  deltaT(jd: number): number {
    this.checkOpen();
    return this.mod.ccall('swe_deltat', 'number', ['number'], [jd]) as number;
  }

  /** Apparent sidereal time (hours) at a UT Julian Day, Greenwich. */
  sidtime(jd: number): number {
    this.checkOpen();
    return this.mod.ccall('swe_sidtime', 'number', ['number'], [jd]) as number;
  }

  // -----------------------------------------------------------------
  // Planet calculation
  // -----------------------------------------------------------------

  /** Compute body position at a Universal Time Julian Day. */
  calcUt(jdUt: number, body: Planet, flags: CalcFlags = SE.FLG.SWIEPH | SE.FLG.SPEED): CalcResult {
    return this.calcInternal('swe_calc_ut', jdUt, body, flags);
  }

  /** Compute body position at an Ephemeris Time (Terrestrial Time) Julian Day. */
  calc(jdEt: number, body: Planet, flags: CalcFlags = SE.FLG.SWIEPH | SE.FLG.SPEED): CalcResult {
    return this.calcInternal('swe_calc', jdEt, body, flags);
  }

  private calcInternal(fn: string, jd: number, body: number, flags: number): CalcResult {
    this.checkOpen();
    const result = this.scratchD6;
    const err = this.scratchErr;
    const retFlags = this.mod.ccall(
      fn,
      'number',
      ['number', 'number', 'number', 'number', 'number'],
      [jd, body, flags, result, err],
    ) as number;
    if (retFlags < 0) {
      throw new Error(`${fn}: ${this.mod.UTF8ToString(err)}`);
    }
    const idx = result >>> 3;
    const h = this.mod.HEAPF64;
    return {
      longitude: h[idx],
      latitude: h[idx + 1],
      distance: h[idx + 2],
      longitudeSpeed: h[idx + 3],
      latitudeSpeed: h[idx + 4],
      distanceSpeed: h[idx + 5],
      retFlags,
    };
  }

  /** Look up the canonical name for a planet number. */
  getPlanetName(planet: number): string {
    this.checkOpen();
    const buf = this.mod._malloc(64);
    try {
      this.mod.ccall('swe_get_planet_name', null, ['number', 'number'], [planet, buf]);
      return this.mod.UTF8ToString(buf);
    } finally {
      this.mod._free(buf);
    }
  }

  // -----------------------------------------------------------------
  // Ayanamsa
  // -----------------------------------------------------------------

  /** Ayanamsa (degrees) at UT Julian Day, current sidereal mode. */
  getAyanamsaUt(jdUt: number): number {
    this.checkOpen();
    return this.mod.ccall('swe_get_ayanamsa_ut', 'number', ['number'], [jdUt]) as number;
  }

  /** Ayanamsa at TT Julian Day. */
  getAyanamsa(jdEt: number): number {
    this.checkOpen();
    return this.mod.ccall('swe_get_ayanamsa', 'number', ['number'], [jdEt]) as number;
  }

  /**
   * Ayanamsa with full precision and explicit flags (recommended API since
   * Swiss Ephemeris 2.05). Returns the ayanamsa in degrees; throws on error.
   */
  getAyanamsaExUt(jdUt: number, flags: number = SE.FLG.SWIEPH): number {
    this.checkOpen();
    const out = this.scratchD6; // reuse 8 bytes of scratch
    const err = this.scratchErr;
    const ret = this.mod.ccall(
      'swe_get_ayanamsa_ex_ut',
      'number',
      ['number', 'number', 'number', 'number'],
      [jdUt, flags, out, err],
    ) as number;
    if (ret < 0) {
      throw new Error(`swe_get_ayanamsa_ex_ut: ${this.mod.UTF8ToString(err)}`);
    }
    return this.mod.HEAPF64[out >>> 3];
  }

  /** Name of the currently-set ayanamsa. */
  getAyanamsaName(mode: SidMode): string {
    this.checkOpen();
    const ptr = this.mod.ccall(
      'swe_get_ayanamsa_name',
      'number',
      ['number'],
      [mode],
    ) as number;
    return ptr ? this.mod.UTF8ToString(ptr) : '';
  }

  // -----------------------------------------------------------------
  // Houses
  // -----------------------------------------------------------------

  /** Compute house cusps and angles. */
  houses(jdUt: number, lat: number, lon: number, hsys: HouseSystem = 'P'): HousesResult {
    this.checkOpen();
    const cusps = this.scratchD13;
    const ascmc = this.scratchD8;
    const code = hsys.charCodeAt(0);
    const ret = this.mod.ccall(
      'swe_houses',
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number'],
      [jdUt, lat, lon, code, cusps, ascmc],
    ) as number;
    if (ret < 0) {
      throw new Error('swe_houses failed');
    }
    const cIdx = cusps >>> 3;
    const aIdx = ascmc >>> 3;
    const h = this.mod.HEAPF64;
    return {
      cusps: Array.from(h.subarray(cIdx, cIdx + 13)),
      ascmc: Array.from(h.subarray(aIdx, aIdx + 8)),
    };
  }

  /** Compute houses with sidereal/extra flags. */
  housesEx(
    jdUt: number,
    flags: number,
    lat: number,
    lon: number,
    hsys: HouseSystem = 'P',
  ): HousesResult {
    this.checkOpen();
    const cusps = this.scratchD13;
    const ascmc = this.scratchD8;
    const code = hsys.charCodeAt(0);
    const ret = this.mod.ccall(
      'swe_houses_ex',
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [jdUt, flags, lat, lon, code, cusps, ascmc],
    ) as number;
    if (ret < 0) {
      throw new Error('swe_houses_ex failed');
    }
    const cIdx = cusps >>> 3;
    const aIdx = ascmc >>> 3;
    const h = this.mod.HEAPF64;
    return {
      cusps: Array.from(h.subarray(cIdx, cIdx + 13)),
      ascmc: Array.from(h.subarray(aIdx, aIdx + 8)),
    };
  }

  // -----------------------------------------------------------------
  // Misc utilities (pure - no FS / state)
  // -----------------------------------------------------------------

  degnorm(deg: number): number {
    return this.mod.ccall('swe_degnorm', 'number', ['number'], [deg]) as number;
  }

  difdegn(p1: number, p2: number): number {
    return this.mod.ccall('swe_difdegn', 'number', ['number', 'number'], [p1, p2]) as number;
  }

  difdeg2n(p1: number, p2: number): number {
    return this.mod.ccall('swe_difdeg2n', 'number', ['number', 'number'], [p1, p2]) as number;
  }

  /** Library version string (e.g. "2.10.03"). */
  version(): string {
    this.checkOpen();
    const buf = this.mod._malloc(32);
    try {
      this.mod.ccall('swe_version', null, ['number'], [buf]);
      return this.mod.UTF8ToString(buf);
    } finally {
      this.mod._free(buf);
    }
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  /** Free all native resources. The instance is no longer usable. */
  close(): void {
    if (this.closed) return;
    try {
      this.mod.ccall('swe_close', null, [], []);
    } finally {
      this.mod._free(this.scratchD6);
      this.mod._free(this.scratchD13);
      this.mod._free(this.scratchD8);
      this.mod._free(this.scratchErr);
      this.mod._free(this.scratchStar);
      this.closed = true;
    }
  }

  // -----------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------

  private checkOpen(): void {
    if (this.closed) {
      throw new Error('Astrosk instance has been closed');
    }
  }

  private callStr(fn: string, str: string): void {
    const len = this.mod.lengthBytesUTF8(str) + 1;
    const ptr = this.mod._malloc(len);
    try {
      this.mod.stringToUTF8(str, ptr, len);
      this.mod.ccall(fn, null, ['number'], [ptr]);
    } finally {
      this.mod._free(ptr);
    }
  }
}
