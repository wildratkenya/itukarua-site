import { useEffect, useState } from 'react';
import { getPlatformSettings } from '@/lib/database';

export interface PlatformPricing {
  jobseeker: number;
  employerWeekly: number;
  employerDay: number;
  contactAccess: number;
  topRatedPass: number;
  advert10Day: number;
  advert20Day: number;
  advert30Day: number;
}

const DEFAULT_PRICING: PlatformPricing = {
  jobseeker: 100,
  employerWeekly: 200,
  employerDay: 100,
  contactAccess: 100,
  topRatedPass: 100,
  advert10Day: 300,
  advert20Day: 500,
  advert30Day: 800,
};

export function usePlatformPricing(): PlatformPricing {
  const [pricing, setPricing] = useState(DEFAULT_PRICING);

  useEffect(() => {
    let active = true;
    getPlatformSettings().then(settings => {
      if (!active) return;
      setPricing(current => ({
        jobseeker: settings.jobseeker_registration_fee ?? current.jobseeker,
        employerWeekly: settings.employer_weekly_fee ?? current.employerWeekly,
        employerDay: settings.employer_day_fee ?? current.employerDay,
        contactAccess: settings.contact_access_fee ?? current.contactAccess,
        topRatedPass: settings.top_rated_pass_fee ?? current.topRatedPass,
        advert10Day: settings.advert_10_day_fee ?? current.advert10Day,
        advert20Day: settings.advert_20_day_fee ?? current.advert20Day,
        advert30Day: settings.advert_30_day_fee ?? current.advert30Day,
      }));
    });
    return () => { active = false; };
  }, []);

  return pricing;
}
