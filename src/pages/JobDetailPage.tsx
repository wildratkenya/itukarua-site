import React from 'react';
import SEO from '@/lib/seo';

const JobDetailPage: React.FC = () => {
  return (
    <>
      <SEO title="Job Detail" description="Job detail page placeholder" />
      <div className="p-8">
        <h1 className="text-2xl font-bold">Job Detail (Placeholder)</h1>
        <p>This page will display detailed information about a specific job.</p>
      </div>
    </>
  );
};

export default JobDetailPage;

