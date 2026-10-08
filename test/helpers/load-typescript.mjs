import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const cache = new Map();
export function loadTypeScript(file) {
  const filename = resolve(file);
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const localRequire = createRequire(filename);
  const loadedModule = { exports: {} };
  const requireSource = specifier => {
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const base = specifier.startsWith('@/') ? resolve('src', specifier.slice(2)) : resolve(dirname(filename), specifier);
      for (const suffix of ['', '.ts', '.tsx']) if (existsSync(base + suffix) && /\.tsx?$/.test(base + suffix)) return loadTypeScript(base + suffix);
    }
    return localRequire(specifier);
  };
  new Function('require', 'module', 'exports', output)(requireSource, loadedModule, loadedModule.exports);
  cache.set(filename, loadedModule.exports);
  return loadedModule.exports;
}
