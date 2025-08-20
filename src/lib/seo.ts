import type { Metadata } from 'next';

interface BaseMeta {
  title?: string;
  description?: string;
  canonical?: string;
}

export function buildMeta({ title, description, canonical }: BaseMeta = {}): Metadata {
  const siteName = 'MySite';
  const fullTitle = title ? `${title} · ${siteName}` : siteName;
  return {
    title: fullTitle,
    description: description || 'Modular starter with Tailwind v4 + MDX.',
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: fullTitle,
      description: description || 'Modular starter with Tailwind v4 + MDX.',
      siteName,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: description || 'Modular starter with Tailwind v4 + MDX.',
    },
  };
}
