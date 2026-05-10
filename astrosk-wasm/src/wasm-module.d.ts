/**
 * Type declaration for the Emscripten-generated WASM loader at
 * ../wasm/astrosk.js. The actual file is built by `bash scripts/build.sh`
 * and is not part of the TypeScript source set.
 */
declare module '../wasm/astrosk.js' {
  const factory: (args?: unknown) => Promise<unknown>;
  export default factory;
}
