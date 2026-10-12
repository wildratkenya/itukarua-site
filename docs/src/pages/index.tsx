import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './index.module.css';

const SECTIONS = [
  {
    title: 'Introduction',
    href: '/docs/intro',
    body: 'What Itukarua is, who it connects, and how this documentation is organised.',
  },
  {
    title: 'Architecture',
    href: '/docs/architecture/overview',
    body: 'Repository layout, frontend shell, data layer and edge functions.',
  },
  {
    title: 'Pricing & plans',
    href: '/docs/product/pricing-and-plans',
    body: 'The Free/Premium jobseeker plans, employer access, adverts, boosts and corporate tiers — and how features map to gating.',
  },
  {
    title: 'Roles & gating',
    href: '/docs/product/roles-and-gating',
    body: 'Roles, entitlements, subscription state and the locks that decide who can do what.',
  },
  {
    title: 'Development',
    href: '/docs/development/quickstart',
    body: 'Run it locally, work with Supabase migrations, and use the repository scripts.',
  },
  {
    title: 'Deployment',
    href: '/docs/deployment/',
    body: 'Vercel build, environment variables, and the same-origin proxy rewrites.',
  },
];

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.tagline} description={siteConfig.tagline}>
      <header className={clsx('hero', 'hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">Itukarua — Engineering Docs</h1>
          <p className="hero__subtitle">
            The Kenya marketplace connecting employers, jobseekers and advertisers.
          </p>
        </div>
      </header>
      <main>
        <div className="container">
          <section className={styles.cardGrid}>
            {SECTIONS.map((s) => (
              <Link key={s.href} to={s.href} className={styles.card}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </Layout>
  );
}