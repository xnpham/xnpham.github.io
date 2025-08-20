import type { Pluggable } from 'unified';
// Lazy import to avoid issues during edge / server builds if not needed.
export async function getMdxOptions(opts?: { sanitize?: boolean }): Promise<{ remarkPlugins: Pluggable[]; rehypePlugins: Pluggable[] }> {
  const [remarkGfm, rehypeRaw, rehypeSlug, rehypeAutolinkHeadings, rehypeSanitize, rehypePrettyCode, remarkImageToJsx] = await Promise.all([
    import('remark-gfm').then(m => m.default || m),
    import('rehype-raw').then(m => m.default || m),
    import('rehype-slug').then(m => m.default || m),
    import('rehype-autolink-headings').then(m => m.default || m),
    import('rehype-sanitize').then(m => m.default || m),
    import('rehype-pretty-code').then(m => m.default || m),
    import('./remark-image-to-jsx').then(m => m.default || m),
  ]);
  return {
    remarkPlugins: [remarkGfm, remarkImageToJsx],
    rehypePlugins: [
      [rehypeRaw, { passThrough: ['mdxJsxTextElement', 'mdxJsxFlowElement', 'mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm'] }],
      ...(opts?.sanitize === false ? [] : [rehypeSanitize]),
      rehypeSlug,
      [rehypePrettyCode, {
        theme: 'one-dark-pro',
        keepBackground: false,
        onVisitLine(node: { children: Array<{ type: string; value?: string }> }) {
          if (node.children.length === 0) node.children.push({ type: 'text', value: ' ' });
        },
        onVisitHighlightedLine(node: { properties: { className?: string[] } }) {
          node.properties.className = (node.properties.className || []).concat('line--highlight');
        },
        onVisitHighlightedWord(node: { properties: { className?: string[] } }) {
          node.properties.className = (node.properties.className || []).concat('word--highlight');
        },
      }],
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  };
}
