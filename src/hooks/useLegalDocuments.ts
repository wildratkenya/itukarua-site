import { useEffect, useState } from 'react';
import { COOKIE_POLICY, PRIVACY_POLICY, SUBSCRIPTION_TERMS, TERMS_AND_CONDITIONS } from '@/data/termsContent';
import { getPlatformContent } from '@/lib/database';

export function useLegalDocuments() {
  const [documents, setDocuments] = useState({
    terms: TERMS_AND_CONDITIONS,
    privacy: PRIVACY_POLICY,
    cookies: COOKIE_POLICY,
    subscription: SUBSCRIPTION_TERMS,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      getPlatformContent('terms'),
      getPlatformContent('privacy'),
      getPlatformContent('cookies'),
      getPlatformContent('subscription'),
    ]).then(([terms, privacy, cookies, subscription]) => {
      if (!active) return;
      setDocuments(current => ({
        terms: terms || current.terms,
        privacy: privacy || current.privacy,
        cookies: cookies || current.cookies,
        subscription: subscription || current.subscription,
      }));
    });
    return () => { active = false; };
  }, []);

  return documents;
}
