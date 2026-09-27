import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { ToastProvider } from '@/components/ui/Toast';
import { THEME_SCRIPT } from '@/components/ui/theme';
import { asset } from '@/lib/base-path';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Flying Blue XP Tracker', template: '%s · XP Tracker' },
  description: 'Personal Flying Blue XP, trip and spending tracker.',
  applicationName: 'XP Tracker',
  appleWebApp: { capable: true, title: 'XP Tracker', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: asset('/icon.svg'), type: 'image/svg+xml' }],
    apple: [{ url: asset('/icons/apple-touch-icon.png'), sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
