-- Undo: remove the seed ads when done testing
DELETE FROM advertisements WHERE slot = 'job_listings_top' AND title IN (
  'Hire Skilled Construction Workers Today',
  'PPE Kenya – Safety Gear for Every Job Site'
);
