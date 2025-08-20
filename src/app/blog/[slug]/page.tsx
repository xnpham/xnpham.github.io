import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/posts';
import fs from 'node:fs';
import path from 'node:path';
import MdxRenderer from '@/components/MdxRenderer';

export async function generateStaticParams() {
  // Only pre-render plain markdown (.md) posts; leave .mdx dynamic to avoid build-time MDX runtime issues.
  const dir = path.join(process.cwd(), 'content', 'posts');
  const mdFiles = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return mdFiles.map(f => ({ slug: f.replace(/\.md$/, '') }));
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return (
      <article className="card space-y-4">
        <h1 className="text-2xl md:text-3xl font-semibold">{post.title}</h1>
        <p className="text-xs text-[color:var(--muted)]">{new Date(post.date).toLocaleDateString()}</p>
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