
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xahaxtbudiubelemewna.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: jobs, error: jobsError } = await supabase.from('jobs').select('*').limit(5)
  console.log('Jobs:', jobs?.length, jobsError || '')
  
  const { data: ads, error: adsError } = await supabase.from('service_ads').select('*').limit(5)
  console.log('Ads:', ads?.length, adsError || '')
}

test()
