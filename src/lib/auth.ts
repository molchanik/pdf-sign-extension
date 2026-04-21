import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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

/**
 * Sign in with Google using chrome.identity.getAuthToken.
 * Uses Chrome's native account picker (no consent screen / "unverified app" warning).
 * The Google access token is verified server-side by the google-signin edge function,
 * which returns a magic link token that establishes the Supabase session.
 */
export async function signInWithGoogle(): Promise<void> {
  // Get Google access token via Chrome's native flow
  const accessToken = await new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (token) {
        resolve(token)
      } else {
        reject(new Error("No token received"))
      }
    })
  })

  // Exchange Google token for Supabase session via edge function
  const { data, error: fnError } = await supabase.functions.invoke("google-signin", {
    body: { google_access_token: accessToken },
  })

  if (fnError || !data?.token_hash) {
    throw new Error("Sign-in failed: " + (fnError?.message || "No token received from server"))
  }

  // Verify the token to establish Supabase session
  const { error } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: "magiclink",
  })

  if (error) {
    throw new Error(`Sign-in failed: ${error.message}`)
  }
}

export async function signOut(): Promise<void> {
  // Clear cached Google token so next sign-in shows account picker
  try {
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => {
        if (t) resolve(t)
        else reject()
      })
    })
    await chrome.identity.removeCachedAuthToken({ token })
  } catch {
    // No cached token — nothing to clear
  }
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
