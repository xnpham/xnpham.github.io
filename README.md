# Blog / Content System Guide

This project extends a standard Next.js (App Router) setup into a filesystem‑driven blog with Markdown + MDX, image organization, syntax highlighting, and custom media components.

---
## 1. Directory Layout

```text
content/
	posts/
		my-post.md (or .mdx)
		another-post.mdx
		amazing-feature/
			index.mdx   (preferred slug-based folder pattern)
			assets/     (source images you author with relative refs)
public/
	posts/<slug>/   (published post asset copies – generated)
	image-manifest.json (generated metadata)
	*.svg / global assets
scripts/
	organize-post-images.mjs
	generate-image-manifest.mjs
```

Each `.md` or `.mdx` file under `content/posts` becomes a blog post. Slug = filename (or folder name if using `index.mdx`).

---
 
## 2. Creating a Post

Create `content/posts/my-first-post.mdx` (or `.md`). Frontmatter is required:

```mdx
---
slug: my-first-post        # optional (defaults to filename)
title: My First Post
date: 2025-08-19           # ISO or any parseable string
excerpt: Short summary shown in listings.
---

Your **Markdown** content here.
```

Use `.mdx` when you want JSX or custom components; use `.md` for plain Markdown (it’s rendered with `marked`).

---
 
## 3. Frontmatter Fields

Required: `title`, `date` (auto‑filled if omitted). Optional: `slug`, `excerpt`.

---
 
## 4. MDX Features

Inside `.mdx` you can embed JSX:

```mdx
<Audio src="/sample-audio.mp3" />
<Video src="/posts/demo/clip.mp4" poster="/posts/demo/cover.jpg" />
```

Custom components available:
- `Image` (used automatically for Markdown images via a remark plugin when width/height can be inferred)
- `Audio` `<Audio src="..." />`
- `Video` `<Video src="..." />`
- Code blocks fenced with triple backticks get syntax highlighting via `rehype-pretty-code`.


Raw HTML is allowed (sanitization disabled) – be cautious with untrusted content.

---
 
## 5. Images Workflow

There are two ways to reference images in a post source:

1. Absolute path `/file.svg` referencing something already in `public/`.
2. Relative path `./assets/hero.png` to an author asset you place in the post’s `assets/` directory.


On `npm run prebuild` the pipeline does:

1. `organize-post-images.mjs`:
	- Scans each post for image references.
	- If the post references an absolute image that lives in `public/` it copies nothing (already there).
	- If the post has an `assets/` folder, every file there is copied to `public/posts/<slug>/`.
	- Rewrites any `./assets/<name>` references in the MDX to `/posts/<slug>/<name>` (so final served URL is stable & cacheable).
2. `generate-image-manifest.mjs`:
	- Parses all posts for image refs.
	- Collects dimension & (future) responsive variant metadata for images that exist under `public/`.
	- Writes `.cache/image-manifest.json` and copies it to `public/image-manifest.json` (for optional client use).


Result: after prebuild your MDX no longer contains relative `./assets` paths; they become absolute `/posts/<slug>/...` URLs present in `public/`.

Adding Images (recommended flow):
 
```text
content/posts/my-feature/
	index.mdx
	assets/
		hero.png
		diagram.png
```
Reference inside `index.mdx` as:
```
![Alt text](./assets/hero.png)
<img src="./assets/diagram.png" alt="Diagram" />
```
Run `npm run prebuild` => they’re copied + rewritten.

Why a Manifest? Future enhancement: use `public/image-manifest.json` to feed `sizes`, `srcSet`, and blur placeholders without reading the filesystem at runtime.

---
### 6. Code Highlighting
Fenced code blocks:
```ts
function greet(name: string) {
	return `Hello ${name}`;
}
```
`rehype-pretty-code` handles them. Language = fence info string (e.g. `ts`, `js`, `bash`).

---
### 7. Theming
Light/dark theme toggled by the UI component (Theme toggle in nav). Styles are driven via CSS custom properties and Tailwind utility classes; no author action needed inside posts.

---
### 8. Development & Build

Run dev server:
```bash
npm run dev
```

Generate assets + manifest (also run automatically before `build` if you add a `prebuild` hook in CI):
```bash
npm run prebuild
```

Build & start production:
```bash
npm run build
npm start
```

Lint / typecheck:
```bash
npm run lint
```

---
### 9. Adding a Plain Markdown Post
Just drop `content/posts/quick-note.md` with frontmatter. Plain markdown is rendered to HTML (no JSX support). To upgrade later, rename to `.mdx`.

---
### 10. Using Images Already in `public/`
If you drop `public/diagram.svg` you can reference it directly as `![Diagram](/diagram.svg)` in any post (no rewrite needed). It will also appear in the manifest for dimension metadata if processed.

---
### 11. Limitations / Roadmap
- Responsive variants for raster images are scaffolded (array reserved) but not yet emitted into public – extend `generate-image-manifest.mjs` to write resized versions and expose their public URLs.
- Blur placeholders / dominant color extraction not added yet.
- MDX currently rendered client-only to avoid a React 19 hook mismatch; moving to server RSC MDX would remove the initial empty shell.
- Sanitization disabled: enable in `getMdxOptions({ sanitize: true })` if you need stricter security (will strip raw HTML / potentially some JSX constructs).

---
### 12. Troubleshooting
- Images not appearing? Ensure you ran `npm run prebuild` after adding assets.
- Dimensions missing? Place image in `public/` (manifest only inspects there) or extend script to support published `/posts/<slug>/` paths for variant gen.
- MDX error: Check console output; malformed JSX will surface in build or runtime render.

---
### 13. Minimal Authoring Checklist
1. Create `content/posts/<slug>/index.mdx` with frontmatter.
2. Add `assets/` folder & images; reference them via `./assets/...`.
3. Run `npm run prebuild`.
4. Start dev server, visit `/blog/<slug>`.
5. Commit updated content (generated public assets are reproducible; you may choose to gitignore them except the manifest if desired).

---
### 14. Example Snippet
```mdx
---
title: Amazing Feature
date: 2025-08-19
excerpt: Showing image organization.
---


# Amazing Feature

![Hero](./assets/hero.png)
<Audio src="/sample-audio.mp3" />
```


---
### 15. Extending
- Add new MDX components: create in `src/components/` and add to the `components` map in `MdxRenderer.tsx`.
- Add remark/rehype plugins: modify `src/lib/mdx.ts`.
- Change image rewrite behavior: adjust `scripts/organize-post-images.mjs` (e.g., keep relative paths by skipping the replacement step).

---
Happy writing!

---

## 16. Deploying to GitHub Pages

This repo is configured for static export deployment via GitHub Pages.

Steps:

1. Ensure your default branch is `main` (or `master`, both are wired in the workflow).
2. Push changes – GitHub Action builds and exports to `out/` and publishes.
3. In repo Settings → Pages: set Source = GitHub Actions (should auto‑configure on first deploy).

Local test of export:

```bash
npm ci
npm run prebuild
npm run build   # runs next build + next export
serve out       # optionally preview with any static server
```

If you use a project (non-user) repo name, set `assetPrefix` and `basePath` in `next.config.ts`. For `<user>.github.io` root deployment they are not required.
