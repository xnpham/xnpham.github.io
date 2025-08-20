import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import fs from 'node:fs';
import path from 'node:path';
import { getPostBySlug } from '@/lib/posts';
import MdxRenderer from '@/components/MdxRenderer';

interface PageProps { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), 'content', 'posts');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  return files.map(f => ({ slug: f.replace(/\.mdx?$/, '') }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return { title: post.title, description: post.excerpt || post.title };
  } catch {
    return { title: 'Post not found' };
  }
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return (
      <article className="card space-y-4">
        <h1 className="text-2xl md:text-3xl font-semibold">{post.title}</h1>
        <p className="text-xs text-[color:var(--muted)]">{new Date(post.date).toLocaleDateString()}</p>
        {post.excerpt && <p className="text-sm text-[color:var(--muted)]">{post.excerpt}</p>}
        {post.mdx ? (
          <MdxRenderer code={post.mdx} />
        ) : (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: post.html || '' }} />
        )}
      </article>
    );
  } catch {
    return notFound();
  }
}