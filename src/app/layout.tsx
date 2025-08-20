import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';
import './globals.css';
import Nav from '@/components/Nav';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = buildMeta({
  title: 'Home',
  description: 'Home · Learning · Extra · Blog · Settings',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Nav />
          <main className="container py-8 space-y-8 min-h-dvh">
            {children}
          </main>
          <div className="fixed bottom-4 left-4 z-50"><ThemeToggle /></div>
        </ThemeProvider>
      </body>
    </html>
  );
}