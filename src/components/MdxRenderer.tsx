"use client";
import * as React from 'react';
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote';
import Image, { ImageProps } from 'next/image';

function ResponsiveImage(props: ImageProps) {
  const { alt, ...rest } = props;
  return (
    <span className="block my-4">
      <Image alt={alt} {...rest} className="rounded-md border border-[color:var(--border)]" />
      {alt && <span className="block mt-1 text-center text-xs text-[color:var(--muted)]">{alt}</span>}
    </span>
  );
}

const Video = (props: React.VideoHTMLAttributes<HTMLVideoElement>) => (
  <video controls preload="metadata" className="w-full my-4 rounded-md border border-[color:var(--border)]" {...props} />
);

const CodeBlock = (props: React.HTMLAttributes<HTMLElement>) => (
  <pre className="overflow-auto rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm" {...props} />
);

// Define any custom components for MDX here
const components = {
  // Map standard markdown image to optimized next/image via explicit <Image /> usage in MDX: <Image src="..." width={} height={} alt="" />
  img: (props: { src?: string; alt?: string; width?: number | string; height?: number | string }) => {
    // If remark plugin converted markdown image, width/height present; fallback to 400x300.
    const { src, alt, width, height } = props;
    if (!src) return null;
    const w = typeof width === 'string' ? parseInt(width) : width || 400;
    const h = typeof height === 'string' ? parseInt(height) : height || 300;
    return (
      <span className="block my-4">
        <Image src={src} alt={alt || ''} width={w} height={h} className="rounded-md border border-[color:var(--border)]" />
        {alt && <span className="block mt-1 text-center text-xs text-[color:var(--muted)]">{alt}</span>}
      </span>
    );
  },
  Image: ResponsiveImage,
  Audio: (props: React.AudioHTMLAttributes<HTMLAudioElement>) => (
    <audio controls preload="metadata" className="w-full my-4" {...props} />
  ),
  Video,
  pre: CodeBlock,
};

type ComponentsMap = Record<string, React.ComponentType<unknown>>; // MDXRemote expects index signature

export default function MdxRenderer({ code }: { code: MDXRemoteSerializeResult }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="prose prose-invert max-w-none" />; // avoid server-side render of MDXRemote
  }
  try {
    return (
      <div className="prose prose-invert max-w-none">
        <MDXRemote {...code} components={components as ComponentsMap} />
      </div>
    );
  } catch (e) {
    return <div className="text-red-400 text-sm">MDX render error: {(e as Error).message}</div>;
  }
}
