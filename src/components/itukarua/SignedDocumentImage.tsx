import React, { useEffect, useState } from 'react';
import { resolveDocumentUrl } from '@/lib/documents';

interface SignedDocumentImageProps {
  path: string;
  alt?: string;
  className?: string;
}

// Thumbnail for image certificates that live in the private documents bucket.
const SignedDocumentImage: React.FC<SignedDocumentImageProps> = ({ path, alt = '', className }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    resolveDocumentUrl(path).then(url => { if (active) setSrc(url); });
    return () => { active = false; };
  }, [path]);

  if (!src) return <div className={className} />;
  return <img src={src} alt={alt} className={className} />;
};

export default SignedDocumentImage;
