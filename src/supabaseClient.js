import { createClient } from "@supabase/supabase-js";

// ==========================================
// CONFIGURE YOUR SUPABASE CREDENTIALS HERE
// ==========================================
// Replace these string values with your actual project URL and Anon/Public Key:
const rawUrl = "https://cllimzumlyfxanhyukbh.supabase.co/rest/v1/";

// Clean up the URL: strip off any trailing '/rest/v1' or '/rest/v1/' suffix and trailing slashes.
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const SUPABASE_PUBLIC_KEY = "sb_publishable_mCCHTxcFjJiA-tXwi3ugdQ_v58niXLO";

// Initialize and export the Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
