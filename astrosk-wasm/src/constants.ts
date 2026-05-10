/**
 * Swiss Ephemeris constants. Mirrors values defined in swephexp.h.
 * Kept in a single namespace-like object so consumers can do:
 *   import { SE } from 'astrosk-wasm';
 *   astrosk.calc(jd, SE.SUN, SE.FLG.SWIEPH | SE.FLG.SPEED);
 */

export const SE = {
  // Calendar systems
  JUL_CAL: 0,
  GREG_CAL: 1,

  // Planet numbers
  SUN: 0,
  MOON: 1,
  MERCURY: 2,
  VENUS: 3,
  MARS: 4,
  JUPITER: 5,
  SATURN: 6,
  URANUS: 7,
  NEPTUNE: 8,
  PLUTO: 9,

  MEAN_NODE: 10,
  TRUE_NODE: 11,
  MEAN_APOG: 12,
  OSCU_APOG: 13,
  EARTH: 14,
  CHIRON: 15,
  PHOLUS: 16,
  CERES: 17,
  PALLAS: 18,
  JUNO: 19,
  VESTA: 20,
  INTP_APOG: 21,
  INTP_PERG: 22,

  NPLANETS: 23,
  AST_OFFSET: 10000,

  // Computation flags (combine with bitwise OR)
  FLG: {
    JPLEPH: 1,
    SWIEPH: 2,
    MOSEPH: 4,
    HELCTR: 8,
    TRUEPOS: 16,
    J2000: 32,
    NONUT: 64,
    SPEED3: 128,
    SPEED: 256,
    NOGDEFL: 512,
    NOABERR: 1024,
    EQUATORIAL: 2048,
    XYZ: 4096,
    RADIANS: 8192,
    BARYCTR: 16384,
    TOPOCTR: 32768,
    SIDEREAL: 65536,
    ICRS: 131072,
    DPSIDEPS_1980: 262144,
    JPLHOR: 262144,
    JPLHOR_APPROX: 524288,
    CENTER_BODY: 1048576,
  },

  // Sidereal modes (ayanamsas)
  SIDM: {
    FAGAN_BRADLEY: 0,
    LAHIRI: 1,
    DELUCE: 2,
    RAMAN: 3,
    USHASHASHI: 4,
    KRISHNAMURTI: 5,
    DJWHAL_KHUL: 6,
    YUKTESHWAR: 7,
    JN_BHASIN: 8,
    BABYL_KUGLER1: 9,
    BABYL_KUGLER2: 10,
    BABYL_KUGLER3: 11,
    BABYL_HUBER: 12,
    BABYL_ETPSC: 13,
    ALDEBARAN_15TAU: 14,
    HIPPARCHOS: 15,
    SASSANIAN: 16,
    GALCENT_0SAG: 17,
    J2000: 18,
    J1900: 19,
    B1950: 20,
    SURYASIDDHANTA: 21,
    SURYASIDDHANTA_MSUN: 22,
    ARYABHATA: 23,
    ARYABHATA_MSUN: 24,
    SS_REVATI: 25,
    SS_CITRA: 26,
    TRUE_CITRA: 27,
    TRUE_REVATI: 28,
    TRUE_PUSHYA: 29,
    GALCENT_RGILBRAND: 30,
    GALEQU_IAU1958: 31,
    GALEQU_TRUE: 32,
    GALEQU_MULA: 33,
    GALALIGN_MARDYKS: 34,
    TRUE_MULA: 35,
    GALCENT_MULA_WILHELM: 36,
    ARYABHATA_522: 37,
    BABYL_BRITTON: 38,
    TRUE_SHEORAN: 39,
    GALCENT_COCHRANE: 40,
    GALEQU_FIORENZA: 41,
    VALENS_MOON: 42,
    LAHIRI_1940: 43,
    LAHIRI_VP285: 44,
    KRISHNAMURTI_VP291: 45,
    LAHIRI_ICRC: 46,
    USER: 255,
  },

  // House systems (single-char codes for swe_houses)
  HSYS: {
    PLACIDUS: 'P',
    KOCH: 'K',
    PORPHYRIUS: 'O',
    REGIOMONTANUS: 'R',
    CAMPANUS: 'C',
    EQUAL: 'A', // or 'E'
    VEHLOW_EQUAL: 'V',
    WHOLE_SIGN: 'W',
    MERIDIAN: 'X',
    AZIMUTHAL: 'H',
    POLICH_PAGE: 'T', // topocentric
    ALCABITIUS: 'B',
    GAUQUELIN: 'G',
    MORINUS: 'M',
    KRUSINSKI: 'U',
    APC: 'Y',
    SUNSHINE: 'I',
    SUNSHINE_ALT: 'i',
  },

  // Misc bits
  ECL_NUT: -1,
  AUNIT_TO_KM: 149597870.7,
} as const;

export type SidMode = typeof SE.SIDM[keyof typeof SE.SIDM];
export type HouseSystem = typeof SE.HSYS[keyof typeof SE.HSYS];
export type Planet = number;
export type CalcFlags = number;
