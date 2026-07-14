// Minimal static server that mimics GitHub Pages: serves build/client at the
// /react-qr-lite/ base path, resolving extensionless URLs to index.html.
// Usage: node preview.mjs   (after `npm run build`)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./build/client", import.meta.url));
const BASE = "/react-qr-lite";
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".data": "text/plain",
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  if (pathname === "/" || pathname === BASE) {
    res.writeHead(302, { location: `${BASE}/` });
    res.end();
    return;
  }
  if (!pathname.startsWith(`${BASE}/`)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const rel = pathname.slice(BASE.length + 1);
  let file = normalize(join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (rel === "" || extname(file) === "") file = join(file, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Preview: http://localhost:${PORT}${BASE}/`);
});
