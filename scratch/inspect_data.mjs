
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xahaxtbudiubelemewna.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.Y9YUpREWTY255lTh0RypLa5dr-nmzv6M8EYeWGIDkXs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: jobs } = await supabase.from('jobs').select('id, title, images').limit(1)
  console.log('Job Images Type:', typeof jobs?.[0]?.images, Array.isArray(jobs?.[0]?.images))
  console.log('Job Images Value:', JSON.stringify(jobs?.[0]?.images))
  
  const { data: ads } = await supabase.from('service_ads').select('id, business_name, images').limit(1)
  console.log('Ad Images Type:', typeof ads?.[0]?.images, Array.isArray(ads?.[0]?.images))
  console.log('Ad Images Value:', JSON.stringify(ads?.[0]?.images))
}

test()
