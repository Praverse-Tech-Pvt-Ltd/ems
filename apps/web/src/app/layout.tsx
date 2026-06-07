import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NexGen EMS — Command Center',
  description: 'NexGen Enterprise Employee Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="bg-background text-on-background font-body-lg text-body-lg min-h-screen flex flex-col md:flex-row antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
