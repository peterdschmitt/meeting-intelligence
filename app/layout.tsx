import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Pine Lake — Meeting Intelligence',
  description: 'Track meeting notes, follow-ups, and action items',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased"
        style={{
          background: 'var(--apex-bg)',
          color: 'var(--apex-text)',
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Subtle gradient background blobs */}
        <div className="apex-bg-canvas">
          <div
            className="apex-bg-blob"
            style={{
              top: '-10%',
              left: '-10%',
              width: '40%',
              height: '40%',
              background: 'rgba(46, 98, 255, 0.08)',
            }}
          />
          <div
            className="apex-bg-blob"
            style={{
              bottom: '-10%',
              right: '-10%',
              width: '50%',
              height: '50%',
              background: 'rgba(167, 139, 250, 0.05)',
              animationDelay: '-6s',
            }}
          />
        </div>

        <Sidebar />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <TopBar />
          <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        </main>
      </body>
    </html>
  );
}
