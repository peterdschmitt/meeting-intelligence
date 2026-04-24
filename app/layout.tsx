import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Meeting Intelligence — Equinox PE',
  description: 'Track meeting notes, follow-ups, and action items',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body
        style={{ background: '#0A0A0A', color: '#e1e3e4' }}
        className="flex h-screen overflow-hidden antialiased"
      >
        {/* Ambient background blobs (from Stitch executive_dashboard) */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute animate-blob rounded-full"
            style={{
              top: '-10%', left: '-10%',
              width: '40%', height: '40%',
              background: 'rgba(46,98,255,0.07)',
              filter: 'blur(120px)',
            }}
          />
          <div
            className="absolute animate-blob rounded-full"
            style={{
              bottom: '-10%', right: '-10%',
              width: '50%', height: '50%',
              background: 'rgba(87,27,193,0.04)',
              filter: 'blur(120px)',
              animationDelay: '-5s',
            }}
          />
        </div>

        {/* Sidebar */}
        <Sidebar />

        {/* Main content — scrollable */}
        <main
          className="flex-1 overflow-y-auto relative z-10 custom-scrollbar"
          style={{ marginLeft: 'var(--sidebar-width)' }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
