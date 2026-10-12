import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/frontend',
        'architecture/data-layer',
        'architecture/edge-functions',
      ],
    },
    {
      type: 'category',
      label: 'Product & Gating',
      items: [
        'product/pricing-and-plans',
        'product/roles-and-gating',
        'product/jobs-and-bids',
        'product/contact-and-messaging',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/quickstart',
        'development/database-migrations',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/deployment',
        'deployment/environment',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/git-hygiene'],
    },
  ],
};

export default sidebars;