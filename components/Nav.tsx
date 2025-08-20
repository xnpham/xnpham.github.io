'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@/lib/routes';

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur supports-[backdrop-filter]:bg-black/30">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight text-sm sm:text-base text-white">MySite</Link>
        <nav className="flex items-center gap-6 text-sm">
          {routes.map((r) => {
            const active = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative px-1 py-1 font-medium transition-colors',
                  'text-[color:var(--muted)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded',
                  active && 'text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-blue-500 after:content-[]'
                ].filter(Boolean).join(' ')}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}