# Claude / agent instructions

This file is the entry point for AI coding agents (Claude Code, Cursor,
Copilot, etc.). Read `MAINTAINING.md` for the full procedure; this file
is the short version.

## What this repo is

`astrosk-wasm` is a WebAssembly build of the Swiss Ephemeris C library.
The C source files in `deps/swisseph/` are **vendored verbatim** from
<https://github.com/aloistr/swisseph>. The TypeScript code in `src/` is
a thin marshalling wrapper.

## Hard rules (do not violate)

1. **Never edit `deps/swisseph/*.c` or `*.h`.** They are upstream files
   copied as-is. Modifying them silently produces wrong astronomical
   calculations. To "fix" a bug, fix the wrapper or the build flags.
2. **Memory indexing must use `>>> 3` (doubles) and `>>> 2` (int32).**
   Never use `/ 8` or `/ 4`. See `MAINTAINING.md` § "Memory access
   pattern" for why.
3. **Test before committing any change to the build pipeline.** The
   verification harness (`npm test`) must pass.
4. **Do not bundle `de441.eph`** (or any JPL file) into the package.
   They are gigabytes. Users supply them via `setJplFile()` + their
   own asset hosting.

## Common tasks

### "Sync to the latest Swiss Ephemeris release"

Follow `MAINTAINING.md` § "Sync procedure" steps 1-8 in order. Do not
skip step 7 (build + test). Do not modify wrapper code unless step 5
explicitly calls for it.

### "Add a new swe_* function to the API"

1. Add `_swe_xxx` to `EXPORTS` array in `scripts/build.sh`.
2. Rebuild: `bash scripts/build.sh`.
3. Add a typed method on the `Astrosk` class in `src/astrosk.ts`,
   following existing patterns:
   - For functions returning a pointer to an array of doubles, use the
     `scratchD6` reusable buffer pattern with `>>> 3` indexing.
   - For functions returning a pointer to a string, use
     `UTF8ToString(ptr)`.
   - For functions taking a string, use `lengthBytesUTF8` + `_malloc` +
     `stringToUTF8` + `_free` (see `callStr` helper).
4. Re-export any new types/constants from `src/index.ts`.
5. Add a test case in `tests/verify.mjs` with a known-good value
   captured from native `swetest`.

### "Fix wrong calculations"

If `npm test` fails or a user reports wrong values:

1. **Run the same call against native swetest to confirm.** If swetest
   gives the same wrong answer, the bug is upstream — file with
   Astrodienst, do not patch in this repo.
2. If swetest is correct but our WASM is wrong, the bug is in the
   wrapper (90% of cases) or the build flags (10%). Common wrapper
   bugs:
   - Wrong heap-view index conversion (`/ 8` instead of `>>> 3`).
   - Reusing a scratch buffer in nested calls.
   - Forgetting to free `_malloc`'d pointers.
   - Wrong argument types in `ccall` (a `pointer` must be `'number'`).
3. If a wrapper bug is found, add a regression test that would have
   caught it.

### "Make it smaller / faster"

- Build script uses `-O3` and `-s ALLOW_MEMORY_GROWTH=1`. To shrink
  further, audit `EXPORTED_FUNCTIONS` and remove unused symbols (e.g.
  if you never use eclipse calculations, drop `_swe_sol_eclipse_*`).
- For lazy loading, switch to `-s SINGLE_FILE=0` (already the default)
  and load `astrosk.wasm` after first user interaction.

## What good looks like

- Tropical Sun longitude on **2024-05-15 12:00 UT** = `55.1447878°`
  (within 1e-6).
- Sidereal Sun (True Pushya) on **2026-05-10 11:32:26 UT** = `26.7361°`
  (within 1e-4 of Jagannatha Hora reference, 1e-6 of native swetest).
- Ayanamsa True Pushya on **2026-05-10 11:32:26 UT** = `23.0911°`
  (within 1e-6 of native swetest, ~3" arcsec from JHora display).
- Build size: WASM ~535 KB, JS loader ~68 KB.

If you observe larger drift, something is wrong — investigate before
shipping.
