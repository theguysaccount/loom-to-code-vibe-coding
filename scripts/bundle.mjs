// A small, dependency-free bundler for this repo's own ES modules: each module becomes a function
// scope in one classic script, so the toolbar loads with a plain <script src>, from a bookmarklet,
// or from the plugin's local bridge. It understands only the import/export forms this repo uses
// and refuses anything else, so a new syntax can't slip through silently.
import fs from "node:fs";
import path from "node:path";

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*["'](\.{1,2}\/[^"']+)["'];?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+(async\s+function\*?|function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_DEFAULT_RE = /^export\s+default\s+/m;

function load(file, seen, order) {
  if (seen.has(file)) return;
  seen.add(file);
  const code = fs.readFileSync(file, "utf8");
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) deps.push(path.resolve(path.dirname(file), m[2]));
  for (const dep of deps) load(dep, seen, order);
  order.push({ file, code });
}

export function bundle(entry, { banner = "", define = {}, root = path.dirname(entry) } = {}) {
  const order = [];
  load(path.resolve(entry), new Set(), order);
  const id = (file) => path.relative(root, file).split(path.sep).join("/");
  const parts = [];
  for (const { file, code } of order) {
    const exports = [];
    let hasDefault = false;
    let body = code
      .replace(IMPORT_RE, (_, names, spec) => {
        const list = names.split(",").map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ": "));
        return `const { ${list.join(", ")} } = __m[${JSON.stringify(id(path.resolve(path.dirname(file), spec)))}];`;
      })
      .replace(EXPORT_DECL_RE, (_, kind, name) => {
        exports.push(name);
        return `${kind} ${name}`;
      })
      .replace(EXPORT_DEFAULT_RE, () => {
        hasDefault = true;
        return "const __default = ";
      });
    const leftover = body.match(/^\s*(import|export)\b.*$/m);
    if (leftover) throw new Error(`${id(file)}: unsupported module syntax: ${leftover[0].trim()}`);
    if (/\bimport\s*\(|\bimport\.meta\b/.test(body)) throw new Error(`${id(file)}: dynamic import / import.meta isn't supported`);
    for (const [key, value] of Object.entries(define)) body = body.split(key).join(value);
    const names = [...exports, ...(hasDefault ? ["default: __default"] : [])].join(", ");
    parts.push(`// ${id(file)}\n__m[${JSON.stringify(id(file))}] = (function () {\n${body.trimEnd()}\nreturn { ${names} };\n})();`);
  }
  return `${banner}(function () {\n"use strict";\nconst __m = {};\n${parts.join("\n\n")}\n})();\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [entry, out] = process.argv.slice(2);
  fs.writeFileSync(out, bundle(entry));
  console.log(`bundled ${entry} -> ${out}`);
}
