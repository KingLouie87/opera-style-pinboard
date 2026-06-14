import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Private Pinboard',
    short_name: 'Pinboard',
    description: 'Eigenes visuelles Pinboard für Links, Bilder und Notizen',
    start_url: '/boards',
    display: 'standalone',
    background_color: '#06070a',
    theme_color: '#06070a',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  };
}
