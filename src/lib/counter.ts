import { supabase } from "./auth"

interface SignLimitResult {
  allowed: boolean
  isPro: boolean
  used: number
  limit: number
}

export async function checkSignLimit(): Promise<SignLimitResult> {
  const { data, error } = await supabase.functions.invoke("check-limit")

  if (error || !data) {
    console.warn("check-limit failed, allowing sign:", error)
    return { allowed: true, isPro: false, used: 0, limit: 1 }
  }

  return data as SignLimitResult
}

export async function incrementSignCount(): Promise<void> {
  const { error } = await supabase.functions.invoke("sign-count")

  if (error) {
    console.warn("sign-count increment failed:", error)
  }
}
