import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { getMdxOptions } from '@/lib/mdx';
import { serialize } from 'next-mdx-remote/serialize';
import type { MDXRemoteSerializeResult } from 'next-mdx-remote';
import type { Post } from '@/types/post';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

export async function getAllPosts(): Promise<Post[]> {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  const posts = await Promise.all(files.map(f => getPostBySlug(f.replace(/\.mdx?$/, ''))));
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const mdPath = path.join(POSTS_DIR, `${slug}.md`);
  const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`);
  const isMdx = fs.existsSync(mdxPath);
  const filePath = isMdx ? mdxPath : mdPath;
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  let html = '';
  let mdxSource: MDXRemoteSerializeResult | undefined;
  if (isMdx) {
    const mdxOptions = await getMdxOptions({ sanitize: false });
  mdxSource = await serialize(content, { mdxOptions });
  } else {
    html = marked(content, { async: false }) as string;
  }
  return {
    slug: String(data.slug || slug),
    title: String(data.title || slug),
    date: String(data.date || new Date().toISOString()),
    excerpt: data.excerpt ? String(data.excerpt) : undefined,
    content, // original markdown
    html: html || undefined,
  mdx: mdxSource,
  } as Post;
}
