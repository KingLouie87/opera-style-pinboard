import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pinboard',
    short_name: 'Pinboard',
    description: 'Visuelles Pinboard für Webseiten, Medien, Dateien und Inspirationen.',
    start_url: '/boards',
    display: 'standalone',
    background_color: '#07080b',
    theme_color: '#07080b',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  };
}
