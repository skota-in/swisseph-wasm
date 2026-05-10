/**
 * WASM module loader. Wraps Emscripten's createAstroskModule factory so
 * callers don't need to know about Emscripten internals.
 *
 * Works in:
 *   - Browser via fetch
 *   - Node via fs.readFile (mapped through Emscripten's instantiateWasm hook)
 *   - Any environment where the user supplies pre-fetched WASM bytes
 */

import type { AstroskInitOptions } from './types.js';

export interface WasmModule {
  _malloc(size: number): number;
  _free(ptr: number): void;
  ccall(
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
  ): unknown;
  cwrap(
    name: string,
    returnType: string | null,
    argTypes: string[],
  ): (...args: unknown[]) => unknown;
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  stringToUTF8(str: string, ptr: number, maxBytes: number): void;
  UTF8ToString(ptr: number, maxBytes?: number): string;
  lengthBytesUTF8(str: string): number;
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
    unlink(path: string): void;
    analyzePath(path: string): { exists: boolean };
  };
}

type EmscriptenFactoryArgs = {
  locateFile?: (path: string, prefix: string) => string;
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    cb: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ) => WebAssembly.Exports | object;
  wasmBinary?: ArrayBuffer | Uint8Array;
  print?: (msg: string) => void;
  printErr?: (msg: string) => void;
};

type EmscriptenFactory = (args?: EmscriptenFactoryArgs) => Promise<WasmModule>;

/**
 * Load the WASM module. Resolves with an initialized Emscripten module.
 *
 * The Emscripten factory `createAstroskModule` is imported from the
 * generated `../wasm/astrosk.js`. That file is an ES module that
 * exports the factory as default.
 */
export async function loadAstroskModule(
  options: AstroskInitOptions = {},
): Promise<WasmModule> {
  const factory = await importFactory();

  const factoryArgs: EmscriptenFactoryArgs = {
    print: () => undefined,
    printErr: (msg: string) => {
      // Suppress benign Emscripten warnings; surface actual errors.
      if (
        msg &&
        !msg.includes('warning: ') &&
        !msg.includes('preload')
      ) {
        // eslint-disable-next-line no-console
        console.error('[astrosk]', msg);
      }
    },
  };

  if (options.locateWasm instanceof ArrayBuffer) {
    factoryArgs.wasmBinary = options.locateWasm;
  } else if (typeof options.locateWasm === 'string') {
    const url = options.locateWasm;
    factoryArgs.locateFile = (path: string) =>
      path.endsWith('.wasm') ? url : path;
  } else if (typeof options.locateWasm === 'function') {
    const fn = options.locateWasm;
    factoryArgs.locateFile = (path: string, prefix: string) =>
      path.endsWith('.wasm') ? fn(prefix + path) : prefix + path;
  }

  return factory(factoryArgs);
}

async function importFactory(): Promise<EmscriptenFactory> {
  // Dynamic import keeps the .wasm.js out of the main TS bundle so
  // bundlers can code-split it.
  const mod = (await import('../wasm/astrosk.js')) as {
    default: EmscriptenFactory;
  };
  return mod.default;
}
