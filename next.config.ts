import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['tsx', 'ts', 'mdx'],
  /** Enable static HTML export so we can deploy to GitHub Pages */
  output: 'export',
};

export default withMDX(nextConfig);
