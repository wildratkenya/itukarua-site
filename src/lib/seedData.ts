import { supabase } from '@/lib/supabase';

// Sample data for development
export const seedSampleData = async () => {
  try {
    console.log('🌱 Seeding sample data...');

    // Sample jobs
    const sampleJobs = [
      {
        title: 'House Painting - 3 Bedroom',
        description: 'Need professional painter for 3 bedroom house in Kikuyu. Interior and exterior work.',
        location: 'Kikuyu',
        budget_min: 15000,
        budget_max: 25000,
        deadline: '2026-05-15',
        category: 'Painting',
        status: 'open',
        urgent: false,
        posted_by: 'sample-employer-1',
        posted_by_name: 'John Maina'
      },
      {
        title: 'Plumbing Repair - Kitchen Sink',
        description: 'Kitchen sink is leaking and needs immediate repair. Located in Westlands.',
        location: 'Westlands',
        budget_min: 2000,
        budget_max: 5000,
        deadline: '2026-04-20',
        category: 'Plumbing',
        status: 'open',
        urgent: true,
        posted_by: 'sample-employer-2',
        posted_by_name: 'Sarah Wanjiku'
      },
      {
        title: 'Electrical Wiring - New Installation',
        description: 'Need electrician for complete house wiring. 4 bedroom house in Karen.',
        location: 'Karen',
        budget_min: 30000,
        budget_max: 45000,
        deadline: '2026-06-01',
        category: 'Electrical',
        status: 'open',
        urgent: false,
        posted_by: 'sample-employer-3',
        posted_by_name: 'David Kiprop'
      },
      {
        title: 'Garden Landscaping',
        description: 'Design and implement landscaping for 1/4 acre garden. Include flowers, lawn, and pathways.',
        location: 'Runda',
        budget_min: 25000,
        budget_max: 40000,
        deadline: '2026-05-30',
        category: 'Landscaping',
        status: 'open',
        urgent: false,
        posted_by: 'sample-employer-4',
        posted_by_name: 'Grace Achieng'
      },
      {
        title: 'House Cleaning - Deep Clean',
        description: 'Deep cleaning service needed for 4 bedroom house. Weekly service required.',
        location: 'Kilimani',
        budget_min: 3000,
        budget_max: 6000,
        deadline: '2026-04-25',
        category: 'Domestic Work',
        status: 'open',
        urgent: false,
        posted_by: 'sample-employer-5',
        posted_by_name: 'Peter Oduya'
      },
      {
        title: 'Car Repair - Toyota Corolla',
        description: 'Engine overhaul needed for 2015 Toyota Corolla. Located in CBD.',
        location: 'CBD',
        budget_min: 15000,
        budget_max: 22000,
        deadline: '2026-04-18',
        category: 'Mechanics',
        status: 'open',
        urgent: true,
        posted_by: 'sample-employer-6',
        posted_by_name: 'Mary Nduta'
      }
    ];

    // Sample service ads
    const sampleServices = [
      {
        business_name: 'Kikuyu Plumbing Services',
        description: 'Professional plumbing services for residential and commercial properties. 24/7 emergency repairs.',
        category: 'Plumbing',
        image: '/images/plumber.png',
        location: 'Kikuyu',
        contact: '+254 721 219 359',
        plan: '30-day',
        expiry_date: '2026-05-04',
        featured: true,
        rating: 4.8,
        reviews_count: 45,
        owner_id: 'sample-business-1',
        payment_confirmed: true
      },
      {
        business_name: 'GreenThumb Landscaping',
        description: 'Complete landscaping and garden maintenance services. Design, installation, and upkeep.',
        category: 'Landscaping',
        image: '/images/services.png',
        location: 'Karen',
        contact: '+254 722 123 456',
        plan: '20-day',
        expiry_date: '2026-04-24',
        featured: false,
        rating: 4.6,
        reviews_count: 32,
        owner_id: 'sample-business-2',
        payment_confirmed: true
      },
      {
        business_name: 'Spark Electrical Solutions',
        description: 'Licensed electricians for all your electrical needs. New installations, repairs, and maintenance.',
        category: 'Electrical',
        image: '/images/services.png',
        location: 'Westlands',
        contact: '+254 723 456 789',
        plan: '30-day',
        expiry_date: '2026-05-04',
        featured: true,
        rating: 4.9,
        reviews_count: 67,
        owner_id: 'sample-business-3',
        payment_confirmed: true
      },
      {
        business_name: 'CleanHome Services',
        description: 'Professional cleaning services for homes and offices. Regular and deep cleaning available.',
        category: 'Cleaning',
        image: '/images/services.png',
        location: 'CBD',
        contact: '+254 724 567 890',
        plan: '10-day',
        expiry_date: '2026-04-14',
        featured: false,
        rating: 4.4,
        reviews_count: 28,
        owner_id: 'sample-business-4',
        payment_confirmed: true
      }
    ];

    // Sample profiles
    const sampleProfiles = [
      {
        id: 'sample-worker-1',
        full_name: 'Michael Kiprop',
        profile_image: '/placeholder.svg',
        rating: 4.7,
        reviews_count: 23,
        qualifications: 'Certified Electrician with 5 years experience',
        experience: 'Residential and commercial electrical installations and repairs',
        skills: 'Electrical wiring, installations, repairs, maintenance',
        phone: '+254 725 678 901',
        location: 'Nairobi',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      },
      {
        id: 'sample-worker-2',
        full_name: 'Ann Wanjiku',
        profile_image: '/placeholder.svg',
        rating: 4.8,
        reviews_count: 31,
        qualifications: 'Professional House Cleaner',
        experience: 'House cleaning and organization services',
        skills: 'Deep cleaning, regular cleaning, office cleaning',
        phone: '+254 726 789 012',
        location: 'Kikuyu',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      },
      {
        id: 'sample-worker-3',
        full_name: 'James Oduya',
        profile_image: '/placeholder.svg',
        rating: 4.6,
        reviews_count: 18,
        qualifications: 'Master Plumber',
        experience: 'All types of plumbing work including installations and repairs',
        skills: 'Plumbing, pipe fitting, water systems, drainage',
        phone: '+254 727 890 123',
        location: 'Westlands',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      },
      {
        id: 'sample-worker-4',
        full_name: 'Grace Achieng',
        profile_image: '/placeholder.svg',
        rating: 4.9,
        reviews_count: 42,
        qualifications: 'Professional Painter',
        experience: 'Interior and exterior painting, wallpapering',
        skills: 'Painting, wallpapering, surface preparation',
        phone: '+254 728 901 234',
        location: 'Karen',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      },
      {
        id: 'sample-worker-5',
        full_name: 'Peter Maina',
        profile_image: '/placeholder.svg',
        rating: 4.5,
        reviews_count: 15,
        qualifications: 'Landscaper and Gardener',
        experience: 'Garden design, lawn care, and landscaping',
        skills: 'Landscaping, gardening, lawn maintenance',
        phone: '+254 729 012 345',
        location: 'Runda',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      },
      {
        id: 'sample-worker-6',
        full_name: 'Susan Kiprop',
        profile_image: '/placeholder.svg',
        rating: 4.7,
        reviews_count: 27,
        qualifications: 'Car Mechanic',
        experience: 'Car repairs and maintenance',
        skills: 'Engine repair, brake systems, electrical systems',
        phone: '+254 730 123 456',
        location: 'CBD',
        role: 'jobseeker',
        verified: true,
        registration_paid: true
      }
    ];

    // Insert sample data
    console.log('📝 Inserting sample jobs...');
    for (const job of sampleJobs) {
      const { error } = await supabase.from('jobs').insert(job);
      if (error) console.error('Error inserting job:', error);
    }

    console.log('🏢 Inserting sample services...');
    for (const service of sampleServices) {
      const { error } = await supabase.from('service_ads').insert(service);
      if (error) console.error('Error inserting service:', error);
    }

    console.log('👥 Inserting sample profiles...');
    for (const profile of sampleProfiles) {
      const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
      if (error) console.error('Error inserting profile:', error);
    }

    console.log('✅ Sample data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
  }
};