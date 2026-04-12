import { supabase } from "./auth"

export interface SignLimitResult {
  allowed: boolean
  isPro: boolean
  used: number
  limit: number
}

export async function checkSignLimit(
  userId: string
): Promise<SignLimitResult> {
  const { data, error } = await supabase.functions.invoke("check-limit", {
    body: { user_id: userId }
  })

  if (error) {
    // On network error, allow the sign (graceful degradation)
    console.warn("check-limit failed, allowing sign:", error)
    return { allowed: true, isPro: false, used: 0, limit: 1 }
  }

  return data as SignLimitResult
}

export async function incrementSignCount(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("sign-count", {
    body: { user_id: userId }
  })

  if (error) {
    console.warn("sign-count increment failed:", error)
  }
}
