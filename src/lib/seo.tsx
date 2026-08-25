import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://www.itukarua.co.ke';
const SITE_NAME = 'Itukarua';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og.jpg`;
const TWITTER_HANDLE = '@itukarua';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile' | 'jobPosting';
  noindex?: boolean;
  jsonLd?: object | object[];
  pageName?: string;
}

// Build title: "{Page Title} | Itukarua" or "{Page Title} in {Location} | Itukarua"
function buildTitle(title?: string, location?: string): string {
  if (!title) return `${SITE_NAME} - Kenya's Local Jobs & Classifieds Platform`;
  const base = location ? `${title} in ${location}` : title;
  return `${base} | ${SITE_NAME}`;
}

// Build description with location/category context
function buildDescription(desc?: string, location?: string, category?: string): string {
  if (desc) return desc;
  const parts: string[] = ['Find'];
  if (category) parts.push(category);
  parts.push('opportunities');
  if (location) parts.push(`in ${location}`);
  parts.push('on Itukarua. Browse jobs, services, and classifieds across Kenya.');
  return parts.join(' ');
}

const SEO: React.FC<SEOProps & { location?: string; category?: string }> = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  jsonLd,
  location,
  category,
}) => {
  const fullTitle = buildTitle(title, location);
  const fullDescription = buildDescription(description, location, category);
  const imageUrl = ogImage || DEFAULT_OG_IMAGE;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;

  const jsonLdArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl || SITE_URL} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_KE" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:site" content={TWITTER_HANDLE} />

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}
    </Helmet>
  );
};

export default SEO;

// ═══════════════════════════════════════════════════════════
// JSON-LD Generator Functions
// ═══════════════════════════════════════════════════════════

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Itukarua Kenya',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description: "Kenya's leading local jobs, classifieds, and services platform connecting jobseekers, employers, and businesses across all 47 counties.",
    foundingDate: '2024',
    sameAs: [
      'https://www.facebook.com/itukarua',
      'https://www.twitter.com/itukarua',
      'https://www.instagram.com/itukarua',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+254-700-000-000',
      contactType: 'customer service',
      availableLanguage: ['English', 'Swahili'],
    },
    areaServed: {
      '@type': 'Country',
      name: 'Kenya',
    },
  };
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Itukarua Kenya',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description: "Kenya's leading local jobs, classifieds, and services platform.",
    telephone: '+254-700-000-000',
    email: 'info@itukarua.co.ke',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KE',
      addressRegion: 'Kiambu',
      addressLocality: 'Kiambu Town',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -1.1714,
      longitude: 36.8296,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Kenya',
    },
    sameAs: [
      'https://www.facebook.com/itukarua',
      'https://www.twitter.com/itukarua',
      'https://www.instagram.com/itukarua',
    ],
  };
}

interface JobPostingInput {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  validThrough?: string;
  employmentType?: string;
  hiringOrganization?: string;
  jobLocation?: string;
  county?: string;
  subcounty?: string;
  baseSalaryMin?: number;
  baseSalaryMax?: number;
  currency?: string;
  category?: string;
  url?: string;
  image?: string;
}

export function generateJobPostingSchema(job: JobPostingInput) {
  const employmentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER'];
  const empType = job.employmentType && employmentTypes.includes(job.employmentType.toUpperCase())
    ? job.employmentType.toUpperCase()
    : 'PART_TIME';

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description?.replace(/<[^>]*>/g, '').substring(0, 5000),
    datePosted: job.datePosted,
    validThrough: job.validThrough || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    employmentType: empType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.hiringOrganization || SITE_NAME,
      sameAs: SITE_URL,
      logo: `${SITE_URL}/images/logo.png`,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.subcounty || job.jobLocation || '',
        addressRegion: job.county || '',
        addressCountry: 'KE',
      },
    },
    baseSalary: job.baseSalaryMin ? {
      '@type': 'MonetaryAmount',
      currency: job.currency || 'KES',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.baseSalaryMin,
        maxValue: job.baseSalaryMax || job.baseSalaryMin,
        unitText: 'MONTH',
      },
    } : undefined,
    url: job.url || `${SITE_URL}/jobs/${job.id}`,
    image: job.image || DEFAULT_OG_IMAGE,
    identifier: {
      '@type': 'PropertyValue',
      name: SITE_NAME,
      value: job.id,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    industry: job.category || 'General',
    jobBenefits: 'Flexible working hours, M-Pesa payments',
  };
}

interface ItemListInput {
  name: string;
  description?: string;
  url: string;
  numberOfItems: number;
  items: { name: string; url: string; position: number; image?: string }[];
}

export function generateItemListSchema(data: ItemListInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: data.name,
    description: data.description || `${data.name} on ${SITE_NAME}`,
    numberOfItems: data.numberOfItems,
    itemListElement: data.items.map(item => ({
      '@type': 'ListItem',
      position: item.position,
      url: item.url,
      name: item.name,
      image: item.image || DEFAULT_OG_IMAGE,
    })),
  };
}

interface BreadcrumbInput {
  items: { name: string; url: string }[];
}

export function generateBreadcrumbSchema(data: BreadcrumbInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: data.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

// Check if a job is expired
export function isJobExpired(validThrough?: string): boolean {
  if (!validThrough) return false;
  return new Date(validThrough) < new Date();
}
