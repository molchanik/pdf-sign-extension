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
 * Sign in with Google using chrome.identity.launchWebAuthFlow.
 * This handles the OAuth redirect inside the extension context
 * instead of opening a new tab that redirects to localhost.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = chrome.identity.getRedirectURL()

  // Get the OAuth URL from Supabase
  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    }
  })

  if (!data.url) {
    throw new Error("Failed to get OAuth URL")
  }

  // Use chrome.identity to handle the OAuth flow in a popup
  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: data.url, interactive: true },
      (callbackUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (callbackUrl) {
          resolve(callbackUrl)
        } else {
          reject(new Error("No callback URL"))
        }
      }
    )
  })

  // Extract tokens from the callback URL
  const hashParams = new URLSearchParams(
    responseUrl.split("#")[1] || responseUrl.split("?")[1] || ""
  )

  const accessToken = hashParams.get("access_token")
  const refreshToken = hashParams.get("refresh_token")

  if (!accessToken || !refreshToken) {
    throw new Error("Authentication failed - no tokens received")
  }

  // Set the session in Supabase client
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
