export type Post = {
  slug: string;
  title: string;
  date: string; // ISO string
  excerpt?: string;
  content: string; // markdown
  html?: string; // rendered HTML (optional when loaded via filesystem)
  mdx?: import('next-mdx-remote').MDXRemoteSerializeResult; // serialized MDX (for rich content)
};