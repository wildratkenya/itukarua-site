CREATE OR REPLACE VIEW public.bids_with_bidder AS
SELECT b.id, b.job_id, b.bidder_id, b.price, b.proposal, b.status, b.created_at, b.updated_at,
  p.full_name AS bidder_name,
  p.profile_image AS bidder_image,
  p.rating AS bidder_rating,
  p.reviews_count AS bidder_reviews,
  p.qualifications AS bidder_qualifications,
  p.experience AS bidder_experience,
  p.skills AS bidder_skills,
  p.phone AS bidder_phone,
  p.location AS bidder_location
FROM public.bids b
LEFT JOIN public.profiles p ON b.bidder_id = p.id;

ALTER VIEW public.bids_with_bidder OWNER TO postgres;
