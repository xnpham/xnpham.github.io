import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';
import './globals.css';
import Nav from '@/components/Nav';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ActivityProvider } from '@/components/ActivityProvider';
import ActivityPanel from '@/components/ActivityPanel';
import GlobalYouTubeBootstrap from '@/components/GlobalYouTubeBootstrap';

export const metadata: Metadata = buildMeta({
  title: 'Home',
  description: 'Home · Learning · Extra · Blog · Settings',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ActivityProvider>
            <GlobalYouTubeBootstrap />
            <Nav />
            <main className="container py-8 space-y-8 min-h-dvh">
              {children}
            </main>
            <ActivityPanel />
            <div className="fixed bottom-4 left-4 z-50"><ThemeToggle /></div>
          </ActivityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}