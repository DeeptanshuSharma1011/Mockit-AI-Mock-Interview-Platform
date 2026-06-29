import { createClient } from "@supabase/supabase-js";

// Extract raw URL from environment or use fallback
const rawUrl = process.env.SUPABASE_URL || "https://cllimzumlyfxanhyukbh.supabase.co/rest/v1/";

// Automatically clean up URL: strip trailing '/rest/v1/' or '/rest/v1' and any trailing slashes.
// The Supabase JS library expects the clean base domain and appends '/rest/v1' automatically.
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

// Check for service role keys first (for safe backend admin access bypassing RLS), then public key
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const rawPublicKey = process.env.SUPABASE_PUBLIC_KEY;
const rawKey = rawServiceKey || rawPublicKey;

export const SUPABASE_PUBLIC_KEY = (rawKey && rawKey.trim().startsWith("eyJ")) 
  ? rawKey.trim() 
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbGltenVtbHlmeGFuaHl1a2JoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY1ODYzMywiZXhwIjoyMDk4MjM0NjMzfQ.xSjftO1LJu4eywWUifHLfLovz3trBi7LcbY6fwohfiI";

export let isUsingMockDB = false;

// Mock database store for fallback
export const mockDB = {
  users: [] as any[],
  interviews: [] as any[],
};

export let supabase: any = null;

export async function connectDB() {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    console.warn("⚠️ SUPABASE_URL or SUPABASE_PUBLIC_KEY environment variable not detected. Falling back to local/in-memory simulated database for instant preview.");
    isUsingMockDB = true;
    return;
  }

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        persistSession: false
      }
    });
    const keyPrefix = SUPABASE_PUBLIC_KEY ? SUPABASE_PUBLIC_KEY.substring(0, 10) : "none";
    console.log(`⚡ Supabase client initialized successfully at ${SUPABASE_URL} (Key prefix: ${keyPrefix}...)`);
    isUsingMockDB = false;
  } catch (error: any) {
    console.error("❌ Supabase initialization error:", error.message);
    console.warn("⚠️ Falling back to in-memory simulated database to ensure zero-friction app preview.");
    isUsingMockDB = true;
  }
}
