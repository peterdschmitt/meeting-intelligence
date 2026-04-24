import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Pine Lake — Meeting Intelligence',
  description: 'Track meeting notes, follow-ups, and action items',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body
        style={{ background: '#050505', color: '#e5e5e7', display: 'flex', height: '100vh', overflow: 'hidden' }}
        className="antialiased"
      >
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ background: '#050505' }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
