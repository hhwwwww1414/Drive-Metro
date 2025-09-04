import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metro Map',
  description: 'Russia metro-style routing map',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
