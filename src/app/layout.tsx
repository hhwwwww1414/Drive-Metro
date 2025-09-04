import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['cyrillic', 'latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Metro Map',
  description: 'Russia metro-style routing map',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
