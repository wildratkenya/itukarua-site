import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// The repository is a single Vite SPA deployed on Vercel. This Docusaurus site
// documents it. Point `url` + `baseUrl` at wherever you host the docs build
// (e.g. a `/docs` path on the same origin, or a dedicated deployment).
const config: Config = {
  title: 'Itukarua',
  tagline: 'Engineering docs for the Itukarua marketplace',
  favicon: 'img/favicon.svg',

  url: 'https://itukarua3.vercel.app',
  baseUrl: '/docs/',

  organizationName: 'wildratkenya',
  projectName: 'itukarua-site',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/wildratkenya/itukarua-site/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Itukarua Docs',
      items: [
        { to: '/', label: 'Home', position: 'left' },
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        {
          href: 'https://itukarua3.vercel.app',
          label: 'Live site',
          position: 'right',
        },
        {
          href: 'https://github.com/wildratkenya/itukarua-site',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/intro' },
            { label: 'Architecture', to: '/docs/architecture/overview' },
            { label: 'Pricing & plans', to: '/docs/product/pricing-and-plans' },
            { label: 'Quickstart', to: '/docs/development/quickstart' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'Itukarua (live)', href: 'https://itukarua3.vercel.app' },
            { label: 'GitHub repo', href: 'https://github.com/wildratkenya/itukarua-site' },
            { label: 'Supabase', href: 'https://supabase.com' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Itukarua.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;