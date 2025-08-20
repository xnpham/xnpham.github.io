#!/usr/bin/env node
/*
  Ensures each post has its own asset folder structure:
    content/posts/<slug>/index.mdx (or .md)
    content/posts/<slug>/assets/* (images placed here by author or moved from public/raw-post-images)
  The script will:
    1. Scan content/posts for loose image references (e.g. /globe.svg) used in a post.
    2. If image file exists directly under public/ and not already under a post assets folder, copy it into content/posts/<slug>/assets/ and rewrite the markdown/MDX to use a relative path ./assets/<file>.
    3. Leave existing relative ./ or ./assets references untouched.
  This is idempotent; running multiple times won't duplicate moves.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const PUBLIC_DIR = path.join(ROOT, 'public');

function listPostFiles() {
  return fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function extractImages(text) {
  const refs = new Set();
  const md = /!\[[^\]]*\]\(([^)]+)\)/g;
  const raw = /<img[^>]*src=["']([^"']+)["']/gi;
  let m; while((m=md.exec(text))) refs.add(m[1]);
  while((m=raw.exec(text))) refs.add(m[1]);
  return Array.from(refs).filter(r => !/^https?:/i.test(r));
}

function moveImage(slug, imgPath) {
  if (imgPath.startsWith('./') || imgPath.startsWith('../')) return null; // already relative
  if (imgPath.startsWith('/')) imgPath = imgPath.slice(1);
  const abs = path.join(PUBLIC_DIR, imgPath);
  if (!fs.existsSync(abs)) return null;
  const assetsDir = path.join(POSTS_DIR, slug, 'assets');
  ensureDir(assetsDir);
  const fileName = path.basename(imgPath);
  const dest = path.join(assetsDir, fileName);
  if (!fs.existsSync(dest)) fs.copyFileSync(abs, dest);
  return `./assets/${fileName}`;
}

function rewriteContent(content, replacements) {
  let out = content;
  for (const [orig, next] of replacements) {
    if (!next) continue;
    // replace markdown ref
    const mdRe = new RegExp(`(!\\[[^\\]]*\\]\()${orig.replace(/[.*+?^${}()|[\]\\]/g, r=>`\\${r}`)}(\))`, 'g');
    out = out.replace(mdRe, `$1${next}$2`);
    // replace img tag src
    const htmlRe = new RegExp(`(<img[^>]*src=["'])${orig.replace(/[.*+?^${}()|[\]\\]/g, r=>`\\${r}`)}(["'])`, 'g');
    out = out.replace(htmlRe, `$1${next}$2`);
  }
  return out;
}

function main() {
  const posts = listPostFiles();
  for (const file of posts) {
    const slug = file.replace(/\.mdx?$/, '');
    const full = path.join(POSTS_DIR, file);
    let text = fs.readFileSync(full, 'utf8');
    const images = extractImages(text);
    const replacements = [];
    for (const img of images) {
      const moved = moveImage(slug, img);
      if (moved && moved !== img) replacements.push([img, moved]);
    }
    // Publish assets folder to /public/posts/<slug>/ and rewrite relative ./assets refs to absolute /posts/slug/
    const assetsDir = path.join(POSTS_DIR, slug, 'assets');
    if (fs.existsSync(assetsDir)) {
      const publicPostDir = path.join(PUBLIC_DIR, 'posts', slug);
      if (!fs.existsSync(publicPostDir)) fs.mkdirSync(publicPostDir, { recursive: true });
      const assetFiles = fs.readdirSync(assetsDir).filter(f => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f));
      for (const af of assetFiles) {
        const src = path.join(assetsDir, af);
        const dest = path.join(publicPostDir, af);
        if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        // If markdown references ./assets/<af>, rewrite to /posts/slug/<af>
        const relRef = `./assets/${af}`;
        const absRef = `/posts/${slug}/${af}`;
        if (text.includes(relRef)) {
          const re = new RegExp(relRef.replace(/[.*+?^${}()|[\]\\]/g, r=>`\\${r}`), 'g');
          text = text.replace(re, absRef);
        }
      }
    }
    if (replacements.length || text !== fs.readFileSync(full, 'utf8')) {
      fs.writeFileSync(full, text);
      console.log(`Updated ${file}: ${replacements.length} moves, assets published.`);
    }
  }
}

main();
