import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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

/**
 * Sign in with Google using chrome.identity.getAuthToken.
 * Uses Chrome's native account picker (no consent screen / "unverified app" warning).
 * Exchanges the Google access token for an ID token, then creates a Supabase session.
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

  // Exchange access token for ID token via Google's OAuth2 API
  const idToken = await fetchIdToken(accessToken)

  // Create Supabase session with the Google ID token
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  })

  if (error) {
    throw new Error(`Sign-in failed: ${error.message}`)
  }
}

/**
 * Exchange a Google access token for an ID token.
 * Tries Google's v3 tokeninfo first, falls back to v1 tokeninfo.
 */
async function fetchIdToken(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?access_token=" + accessToken
  )
  if (!res.ok) {
    throw new Error("Failed to verify Google token")
  }
  const info = await res.json()
  if (!info.email) {
    throw new Error("Google token missing email")
  }
  if (info.id_token) {
    return info.id_token
  }

  // Fallback: v1 tokeninfo may return id_token for tokens with openid scope
  const v1Res = await fetch(
    "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + accessToken
  )
  if (!v1Res.ok) {
    throw new Error("Failed to get ID token from Google")
  }
  const v1Info = await v1Res.json()
  if (v1Info.id_token) {
    return v1Info.id_token
  }

  throw new Error("Could not obtain Google ID token")
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
