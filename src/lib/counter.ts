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
    throw new Error(
      "Could not verify your usage limit. Check your connection and try again."
    )
  }

  return data as SignLimitResult
}

export async function incrementSignCount(): Promise<void> {
  const { error } = await supabase.functions.invoke("sign-count")

  if (error) {
    throw new Error(
      "Could not record this sign on the server."
    )
  }
}
