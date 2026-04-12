import { createClient } from "@supabase/supabase-js"

const ANON_ID_KEY = "pdf_sign_anon_id"

export const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Generate a stable anonymous ID using crypto.randomUUID().
 * Stored in chrome.storage.local (not localStorage — popup has no persistent localStorage).
 */
export async function getAnonymousId(): Promise<string> {
  const result = await chrome.storage.local.get(ANON_ID_KEY)
  if (result[ANON_ID_KEY]) return result[ANON_ID_KEY]

  const id = crypto.randomUUID()
  await chrome.storage.local.set({ [ANON_ID_KEY]: id })
  return id
}

/**
 * Return Supabase user ID if logged in, otherwise anonymous ID.
 */
export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user?.id) return data.session.user.id
  return getAnonymousId()
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
