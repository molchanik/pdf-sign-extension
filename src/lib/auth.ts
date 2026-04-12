import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Return Supabase user ID. Requires Google sign-in.
 * Throws if not authenticated.
 */
export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return data.session.user.id
}

/**
 * Check if user is currently signed in.
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session?.user
}

/**
 * Get user email if signed in.
 */
export async function getUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.email ?? null
}

export async function signInWithGoogle(): Promise<void> {
  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: chrome.identity.getRedirectURL()
    }
  })
  if (data.url) {
    chrome.tabs.create({ url: data.url })
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
