/**
 * Public TypeScript types for astrosk-wasm.
 */

export interface CalcResult {
  /** Ecliptic longitude in degrees (0-360), or x in xyz/equatorial mode. */
  longitude: number;
  /** Ecliptic latitude in degrees, or y in xyz/equatorial mode. */
  latitude: number;
  /** Distance in AU, or z in xyz mode. */
  distance: number;
  /** Speed in longitude (deg/day). Only valid if FLG.SPEED was passed. */
  longitudeSpeed: number;
  /** Speed in latitude (deg/day). */
  latitudeSpeed: number;
  /** Speed in distance (AU/day). */
  distanceSpeed: number;
  /** Bitmask of flags actually used. May differ from requested flags on fallback. */
  retFlags: number;
}

export interface HousesResult {
  /** House cusps. cusps[1]..cusps[12] for 12 houses, cusps[0] unused. */
  cusps: number[];
  /** Ascendant, MC, ARMC, Vertex, equatorial ascendant, co-ascendant (Koch),
   *  co-ascendant (Munkasey), polar ascendant. */
  ascmc: number[];
}

export interface UtcDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface JdConversion {
  /** Julian Day in Universal Time. */
  jdUt: number;
  /** Julian Day in Ephemeris Time (Terrestrial Time). */
  jdEt: number;
}

export interface RevjulResult {
  year: number;
  month: number;
  day: number;
  hour: number;
}

export interface AstroskInitOptions {
  /**
   * Path inside the WASM virtual FS where ephemeris files are mounted.
   * Defaults to "/ephe". Files copied there via `loadEphemerisFile()`
   * become available to swe_calc when this path is set as the ephe path.
   */
  ephePath?: string;

  /**
   * Optional locator for the WASM binary. If not provided, the bundled
   * loader will attempt to fetch ./astrosk.wasm relative to the JS file.
   *
   *  - string: a URL or filesystem path
   *  - function: called with the default URL, return a different one
   *  - ArrayBuffer: provide pre-fetched WASM bytes
   */
  locateWasm?: string | ((defaultUrl: string) => string) | ArrayBuffer;

  /**
   * If true, do not attempt to call swe_set_ephe_path automatically.
   * Useful when you intend to use the Moshier model only (FLG.MOSEPH).
   */
  noEphePath?: boolean;
}
