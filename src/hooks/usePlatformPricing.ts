import { useEffect, useState } from 'react';
import { getPlatformSettings } from '@/lib/database';
import { PRICING_PLANS } from '@/data/siteData';

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
  jobseeker: PRICING_PLANS.jobseekerPremium.price,
  employerWeekly: PRICING_PLANS.employerSubscription.price,
  employerDay: PRICING_PLANS.singleJobPost.price,
  contactAccess: PRICING_PLANS.contactUnlock.price,
  topRatedPass: PRICING_PLANS.jobseekerPremium.price,
  advert10Day: PRICING_PLANS.advertPlans[0].price,
  advert20Day: PRICING_PLANS.advertPlans[1].price,
  advert30Day: PRICING_PLANS.advertPlans[2].price,
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
