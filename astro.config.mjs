// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

import node from '@astrojs/node';

// https://astro.build/config
const SITE_URL = process.env.SITE_URL || 'http://cintasfashionstore.victoriafp.online';

export default defineConfig({
  site: SITE_URL,
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()],

  adapter: node({
    mode: 'standalone'
  })
});