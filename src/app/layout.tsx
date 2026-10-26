import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UtsavPilot — Celebration & Event Co-Pilot with Event Ripple Engine',
  description:
    'Intelligent, budget-conscious event orchestration for weddings, birthdays, and community festivals powered by Gemini 3.8 Flash and deterministic ripple impact reasoning.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen text-slate-900 bg-stone-50 selection:bg-amber-200 selection:text-amber-900">
        {children}
      </body>
    </html>
  );
}
