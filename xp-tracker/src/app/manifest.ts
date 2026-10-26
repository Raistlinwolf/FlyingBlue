import type { MetadataRoute } from 'next';
import { asset } from '@/lib/base-path';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flying Blue XP Tracker',
    short_name: 'XP Tracker',
    description: 'Log flights, SAF and other XP sources and track your Flying Blue qualification cycle.',
    id: asset('/'),
    start_url: asset('/dashboard/'),
    scope: asset('/'),
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f4f4f1',
    theme_color: '#0b3a75',
    categories: ['travel', 'productivity'],
    icons: [
      { src: asset('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: asset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: asset('/icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add booking', url: asset('/add/booking/') },
      { name: 'Add XP', url: asset('/add/xp/') },
      { name: 'Calendar', url: asset('/calendar/') },
    ],
  };
}
