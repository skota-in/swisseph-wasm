#!/usr/bin/env bash
# Build astrosk-wasm: compiles Swiss Ephemeris C sources to WebAssembly.
#
# Requires: Emscripten SDK activated (source <emsdk>/emsdk_env.sh)
#
# Output:
#   wasm/astrosk.js   - Emscripten loader (ES module)
#   wasm/astrosk.wasm - WebAssembly binary
#
# The bundled .se1 ephemeris files are NOT preloaded into the WASM binary.
# They are shipped as separate files in deps/ephe/ and loaded at runtime
# by the JS wrapper into the virtual filesystem (/ephe). This keeps the
# WASM small and lets users supply their own (e.g. de441.eph for JPL).

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v emcc >/dev/null 2>&1; then
  echo "ERROR: emcc not found in PATH." >&2
  echo "" >&2
  echo "Install Emscripten and activate it before building:" >&2
  echo "" >&2
  echo "  Linux/macOS:" >&2
  echo "    git clone https://github.com/emscripten-core/emsdk.git ~/emsdk" >&2
  echo "    cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest" >&2
  echo "    source ~/emsdk/emsdk_env.sh" >&2
  echo "" >&2
  echo "  Windows (Git Bash / PowerShell):" >&2
  echo "    git clone https://github.com/emscripten-core/emsdk.git C:/emsdk" >&2
  echo "    cd C:/emsdk" >&2
  echo "    ./emsdk install latest" >&2
  echo "    ./emsdk activate latest" >&2
  echo "    # Git Bash:    source ./emsdk_env.sh" >&2
  echo "    # PowerShell:  ./emsdk_env.ps1" >&2
  echo "    # cmd.exe:     emsdk_env.bat" >&2
  echo "" >&2
  echo "After activating, re-run: pnpm build:wasm" >&2
  exit 1
fi

mkdir -p wasm

SOURCES=(
  deps/swisseph/swedate.c
  deps/swisseph/swehouse.c
  deps/swisseph/swejpl.c
  deps/swisseph/swemmoon.c
  deps/swisseph/swemplan.c
  deps/swisseph/sweph.c
  deps/swisseph/swephlib.c
  deps/swisseph/swecl.c
  deps/swisseph/swehel.c
)

# Public Swiss Ephemeris functions exposed to JavaScript.
# Underscore prefix is required by Emscripten for C exports.
EXPORTS='[
  "_malloc","_free",
  "_swe_version","_swe_set_ephe_path","_swe_set_jpl_file","_swe_close",
  "_swe_julday","_swe_revjul","_swe_date_conversion",
  "_swe_utc_to_jd","_swe_jdet_to_utc","_swe_jdut1_to_utc","_swe_utc_time_zone",
  "_swe_deltat","_swe_deltat_ex","_swe_set_tid_acc","_swe_get_tid_acc",
  "_swe_calc","_swe_calc_ut","_swe_calc_pctr",
  "_swe_get_planet_name","_swe_set_topo",
  "_swe_set_sid_mode","_swe_get_ayanamsa","_swe_get_ayanamsa_ut",
  "_swe_get_ayanamsa_ex","_swe_get_ayanamsa_ex_ut","_swe_get_ayanamsa_name",
  "_swe_houses","_swe_houses_ex","_swe_houses_ex2","_swe_houses_armc","_swe_houses_armc_ex2",
  "_swe_house_pos","_swe_house_name","_swe_gauquelin_sector",
  "_swe_sidtime","_swe_sidtime0",
  "_swe_fixstar","_swe_fixstar_ut","_swe_fixstar_mag",
  "_swe_fixstar2","_swe_fixstar2_ut","_swe_fixstar2_mag",
  "_swe_nod_aps","_swe_nod_aps_ut","_swe_get_orbital_elements","_swe_orbit_max_min_true_distance",
  "_swe_sol_eclipse_where","_swe_sol_eclipse_how","_swe_sol_eclipse_when_loc",
  "_swe_sol_eclipse_when_glob","_swe_lun_eclipse_how","_swe_lun_eclipse_when",
  "_swe_lun_eclipse_when_loc","_swe_lun_occult_where","_swe_lun_occult_when_loc",
  "_swe_lun_occult_when_glob",
  "_swe_pheno","_swe_pheno_ut",
  "_swe_rise_trans","_swe_rise_trans_true_hor",
  "_swe_azalt","_swe_azalt_rev","_swe_refrac","_swe_refrac_extended","_swe_set_lapse_rate",
  "_swe_heliacal_ut","_swe_heliacal_pheno_ut","_swe_vis_limit_mag",
  "_swe_cotrans","_swe_cotrans_sp",
  "_swe_degnorm","_swe_radnorm","_swe_rad_midp","_swe_deg_midp","_swe_split_deg",
  "_swe_difdegn","_swe_difdeg2n","_swe_difrad2n","_swe_difcsn","_swe_difcs2n",
  "_swe_csnorm","_swe_csroundsec","_swe_d2l","_swe_day_of_week",
  "_swe_cs2timestr","_swe_cs2lonlatstr","_swe_cs2degstr"
]'

RUNTIME_METHODS='[
  "ccall","cwrap","FS","HEAPF64","HEAPF32","HEAP32","HEAPU8",
  "stringToUTF8","UTF8ToString","lengthBytesUTF8",
  "getValue","setValue","writeArrayToMemory"
]'

echo "Compiling astrosk-wasm..."
emcc -O3 \
  "${SOURCES[@]}" \
  -I deps/swisseph \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME="createAstroskModule" \
  -s ENVIRONMENT="web,worker,node" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=33554432 \
  -s STACK_SIZE=5242880 \
  -s FILESYSTEM=1 \
  -s FORCE_FILESYSTEM=1 \
  -s EXPORTED_FUNCTIONS="$EXPORTS" \
  -s EXPORTED_RUNTIME_METHODS="$RUNTIME_METHODS" \
  -s NO_EXIT_RUNTIME=1 \
  -s INVOKE_RUN=0 \
  -s ASSERTIONS=0 \
  -s SINGLE_FILE=0 \
  -o wasm/astrosk.js

echo "Build complete:"
ls -lh wasm/astrosk.js wasm/astrosk.wasm
