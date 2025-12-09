import { createClient } from '@supabase/supabase-js';

// Configuration specific to your Supabase project
const supabaseUrl = 'https://nuczuecafijcpedbiqqi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y3p1ZWNhZmlqY3BlZGJpcXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA1NTEsImV4cCI6MjA4MDc5NjU1MX0.dnygAglxh3gFnt9dX68AcIFgZlIq5-qTviKGFEYK8ec';

export const supabase = createClient(supabaseUrl, supabaseKey);
