import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

export default async function BlogIndex() {
  const sorted = await getAllPosts();
  return (
    <section className="space-y-6">
      <div className="card">
        <h1 className="text-2xl md:text-3xl font-semibold">Blog</h1>
        <p className="text-[color:var(--muted)]">Lightweight blog powered by Markdown strings.</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {sorted.map((p) => (
          <li key={p.slug} className="card space-y-2">
            <h2 className="text-xl font-semibold">
              <Link href={`/blog/${p.slug}`}>{p.title}</Link>
            </h2>
            <p className="text-xs text-[color:var(--muted)]">{new Date(p.date).toLocaleDateString()}</p>
            {p.excerpt && <p className="text-sm text-[color:var(--muted)]">{p.excerpt}</p>}
            <div>
              <Link className="btn btn-primary" href={`/blog/${p.slug}`}>Read →</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}