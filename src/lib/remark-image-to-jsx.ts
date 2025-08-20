import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'unified';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';
import imageSize from 'image-size';

// Remark plugin: transform Markdown image syntax ![alt](src) into an MDX <Image /> component
// Adds width/height (from file if local) and keeps alt text.
// Remote URLs: leaves as-is (can't pre-measure without fetch).

interface MutableImageNode extends Node { url?: string; alt?: string | null; name?: string; attributes?: Array<{ type: string; name: string; value?: string }>; }

const plugin: Plugin = () => (tree: Node) => {
  visit(tree, 'image', (node: MutableImageNode) => {
    if (!node.url) return;
    if (/^https?:/i.test(node.url)) return; // skip remote images
    const imgPath = path.join(process.cwd(), 'public', node.url.replace(/^\//, ''));
    if (!fs.existsSync(imgPath)) return;
    try {
      const { width, height } = imageSize(imgPath);
      if (!width || !height) return;
  (node as MutableImageNode).type = 'mdxJsxFlowElement';
  node.name = 'Image';
  node.attributes = [
        { type: 'mdxJsxAttribute', name: 'src', value: node.url },
        { type: 'mdxJsxAttribute', name: 'width', value: String(width) },
        { type: 'mdxJsxAttribute', name: 'height', value: String(height) },
        { type: 'mdxJsxAttribute', name: 'alt', value: node.alt || '' },
      ];
  delete node.url;
  delete node.alt;
    } catch {
      // ignore failures
    }
  });
};

export default plugin;
