import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Opera Style Pinboard',
    short_name: 'Pinboard',
    description: 'Eigenes visuelles Pinboard für Links, Bilder und Notizen',
    start_url: '/boards',
    display: 'standalone',
    background_color: '#f5f1eb',
    theme_color: '#e44332',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  };
}
