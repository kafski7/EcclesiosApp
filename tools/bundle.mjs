#!/usr/bin/env node
/**
 * Pack / unpack the Ecclesios source tree as ONE Markdown file (chat hand-off).
 *
 *   node tools/bundle.mjs pack   [out=ecclesios-bundle.md]
 *   node tools/bundle.mjs unpack <bundle.md> [targetDir=.]
 *   node tools/bundle.mjs list   <bundle.md>
 *
 * Plain Node (>=18), no dependencies. Skips node_modules, build output, lock files,
 * real .env files and binaries. The first file in every bundle is this script, so a
 * bundle can always be unpacked even without a checkout.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".turbo", "coverage", ".git", ".next", ".expo", "out"]);
const SKIP_FILES = [/^pnpm-lock\.yaml$/, /^\.env$/, /^\.env\.(?!example$)/, /^ecclesios-bundle.*\.md$/, /\.log$/, /^\.DS_Store$/];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp3|mid|midi|woff2?|ttf|otf|eot)$/i;
const BEGIN = "<<<<<< FILE: ";
const END = "<<<<<< END FILE: ";
const TAIL = " >>>>>>";

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (!SKIP_FILES.some((re) => re.test(name)) && !BINARY_EXT.test(name)) {
      out.push(relative(ROOT, full).split(sep).join("/"));
    }
  }
  return out;
}

function pack(outFile = "ecclesios-bundle.md") {
  const files = walk(ROOT);
  const self = "tools/bundle.mjs";
  const ordered = [self, ...files.filter((f) => f !== self)];
  const parts = [];
  let bytes = 0;
  for (const f of ordered) {
    const body = readFileSync(join(ROOT, f), "utf8");
    if (body.includes(BEGIN) && f !== self) throw new Error(`${f} contains the bundle marker; cannot pack`);
    bytes += body.length;
    parts.push(`${BEGIN}${f}${TAIL}\n${body}${body.endsWith("\n") ? "" : "\n"}${END}${f}${TAIL}\n`);
  }
  const content = parts.join("\n");
  const sha = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const header = [
    "# Ecclesios source bundle",
    "",
    `Generated ${new Date().toISOString()} · ${ordered.length} files · ${(bytes / 1024).toFixed(0)} KB · sha256:${sha}`,
    "",
    "Unpack: `node tools/bundle.mjs unpack ecclesios-bundle.md <targetDir>`.",
    "No checkout? Copy the first file below (tools/bundle.mjs) out by hand, then run it.",
    "",
    "## Files",
    "",
    ...ordered.map((f) => `- ${f}`),
    "",
    "## Contents",
    "",
  ].join("\n");
  writeFileSync(resolve(outFile), `${header}\n${content}`);
  console.log(`Packed ${ordered.length} files → ${outFile} (sha256:${sha})`);
}

function parse(bundleFile) {
  const lines = readFileSync(resolve(bundleFile), "utf8").split("\n");
  const files = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith(BEGIN) || !line.endsWith(TAIL)) continue;
    const path = line.slice(BEGIN.length, -TAIL.length);
    const endLine = `${END}${path}${TAIL}`;
    const body = [];
    let j = i + 1;
    // tools/bundle.mjs mentions the markers in string literals, so match the exact end line only.
    for (; j < lines.length && lines[j] !== endLine; j++) body.push(lines[j]);
    if (j >= lines.length) throw new Error(`Unterminated file block: ${path}`);
    files.push({ path, content: body.join("\n") + "\n" });
    i = j;
  }
  if (!files.length) throw new Error("No files found — is this an Ecclesios bundle?");
  return files;
}

function unpack(bundleFile, target = ".") {
  const base = resolve(target);
  const files = parse(bundleFile);
  for (const { path, content } of files) {
    const dest = resolve(base, normalize(path));
    if (!dest.startsWith(base + sep)) throw new Error(`Refusing path outside target: ${path}`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }
  console.log(`Unpacked ${files.length} files → ${base}`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pack") pack(a);
else if (cmd === "unpack" && a) unpack(a, b);
else if (cmd === "list" && a) parse(a).forEach((f) => console.log(f.path));
else {
  console.error("Usage: node tools/bundle.mjs pack [out.md] | unpack <bundle.md> [dir] | list <bundle.md>");
  process.exit(1);
}
