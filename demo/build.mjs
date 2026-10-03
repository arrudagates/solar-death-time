// Bundles the demo into one self-contained HTML file: demo/dist/index.html.
// Open it directly in a browser; no server needed.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const here = new URL(".", import.meta.url);
const result = await build({
  entryPoints: [new URL("main.ts", here).pathname],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const page = await readFile(new URL("page.html", here), "utf8");
const body = `${page}\n<script>${js}</script>\n`;

await mkdir(new URL("dist/", here), { recursive: true });
// Fragment (no <html>/<head>/<body>) for hosts that add their own skeleton.
await writeFile(new URL("dist/fragment.html", here), body);
await writeFile(
  new URL("dist/index.html", here),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${body}</body>\n</html>\n`,
);
console.log("Wrote demo/dist/index.html");
