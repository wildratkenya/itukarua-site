import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://yxyqetgwueqxazojujta.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImQyMjNmZDViLTdmM2EtNDNlZS05ZTlkLTYyYjJiMmFhYzk3NiJ9.eyJwcm9qZWN0SWQiOiJ5eHlxZXRnd3VlcXhhem9qdWp0YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcxMDU1Mzg4LCJleHAiOjIwODY0MTUzODgsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.zqBEFVLDlfGGOYMJGHIIodcBU0UnBK-kjTyW4zPiMpQ';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };