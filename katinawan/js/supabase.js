// js/supabase.js

const SUPABASE_URL = "https://eruykqvdytxigjwxfiid.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JRt9OBqdEMY7L11_GBdweg_tBCFqkfZ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log("Supabase client connected:", supabaseClient);