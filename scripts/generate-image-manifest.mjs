#!/usr/bin/env node
/*
  Generates image-manifest.json with metadata & responsive variants for images referenced in content/posts.
  - Scans markdown/MDX for ![...](...) or src="..." image references.
  - For local images under public/ creates resized variants (640, 960, 1280) next to original in .next-cache-images (not checked in) and records widths.
  - Outputs manifest at .cache/image-manifest.json consumed at runtime to avoid fs + size lookups.
*/
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content', 'posts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CACHE_DIR = path.join(ROOT, '.cache');
const OUT_FILE = path.join(CACHE_DIR, 'image-manifest.json');
const PUBLIC_MANIFEST = path.join(PUBLIC_DIR, 'image-manifest.json');
const VARIANTS = [640, 960, 1280];

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function collectContentFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.mdx')).map(f => path.join(dir, f));
}

function extractImageRefs(text) {
  const refs = new Set();
  const mdImg = /!\[[^\]]*\]\(([^)]+)\)/g; // markdown images
  const srcAttr = /src=["']([^"']+\.(?:png|jpg|jpeg|gif|webp|avif|svg))["']/gi;
  let m;
  while ((m = mdImg.exec(text))) refs.add(m[1]);
  while ((m = srcAttr.exec(text))) refs.add(m[1]);
  return Array.from(refs).filter(r => !/^https?:/i.test(r));
}

async function processImage(relPath) {
  const clean = relPath.replace(/^\//, '');
  const abs = path.join(PUBLIC_DIR, clean);
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const image = sharp(buf);
  const meta = await image.metadata();
  const original = { width: meta.width, height: meta.height, format: meta.format };
  const variants = [];
  for (const w of VARIANTS) {
    if (!meta.width || w >= meta.width) continue; // skip upscaling or same size
    const outDir = path.join(CACHE_DIR, 'images');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const ext = meta.format === 'jpeg' ? 'jpg' : meta.format;
    const outName = `${clean.replace(/\.[^.]+$/, '')}-${w}.${ext}`.replace(/\//g, '__');
    const outPath = path.join(outDir, outName);
    if (!fs.existsSync(outPath)) {
      await image.resize({ width: w }).toFile(outPath);
    }
    variants.push({ width: w, file: path.relative(ROOT, outPath) });
  }
  return { path: relPath, original, variants };
}

async function main() {
  const manifest = {};
  const files = collectContentFiles(CONTENT_DIR);
  for (const file of files) {
    const slug = path.basename(file).replace(/\.mdx?$/, '');
    const text = fs.readFileSync(file, 'utf8');
    const refs = extractImageRefs(text);
    for (const ref of refs) {
      const entry = await processImage(ref);
      if (entry) {
        manifest[entry.path] = entry;
        if (!manifest._byPost) manifest._byPost = {};
        (manifest._byPost[slug] ||= []).push(entry.path);
      }
    }
  }
  const json = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(OUT_FILE, json);
  // Also copy to public so the client can fetch it at runtime
  fs.writeFileSync(PUBLIC_MANIFEST, json);
  console.log(`Image manifest written: ${OUT_FILE} and copied to ${PUBLIC_MANIFEST}`);
}

main().catch(e => { console.error(e); process.exit(1); });
