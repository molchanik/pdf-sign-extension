import React, { useEffect, useState } from "react"

import { getSession, signInWithGoogle, signOut } from "~lib/auth"
import { checkProStatus, openUpgradePage } from "~lib/payments"
import { deleteSignature, loadSignature } from "~lib/storage"

import "~styles/globals.css"

export default function Options() {
  const [savedSig, setSavedSig] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    loadSignature().then(setSavedSig)
    getSession().then((s) => setEmail(s?.user?.email ?? null))
    checkProStatus().then(setIsPro)
  }, [])

  const handleDeleteSignature = async () => {
    await deleteSignature()
    setSavedSig(null)
  }

  const handleSignIn = async () => {
    await signInWithGoogle()
  }

  const handleSignOut = async () => {
    await signOut()
    setEmail(null)
    setIsPro(false)
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        PDF Sign Settings
      </h1>

      {/* Saved signature */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Saved Signature
        </h2>
        {savedSig ? (
          <div className="flex items-center gap-3">
            <img
              src={savedSig}
              alt="Saved signature"
              className="border border-gray-200 rounded bg-white p-2"
              style={{ maxWidth: 200, maxHeight: 60 }}
            />
            <button
              onClick={handleDeleteSignature}
              className="btn-secondary text-xs">
              Delete
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No saved signature. Draw one in the extension popup and save it.
          </p>
        )}
      </section>

      {/* Account */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Account</h2>
        {email ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">{email}</p>
            <button onClick={handleSignOut} className="btn-secondary text-xs">
              Sign out
            </button>
          </div>
        ) : (
          <button onClick={handleSignIn} className="btn-primary text-sm">
            Sign in with Google
          </button>
        )}
      </section>

      {/* Subscription */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Subscription
        </h2>
        <p className="text-sm text-gray-600">
          {isPro ? (
            <span className="text-blue-600 font-medium">
              Pro — Unlimited signatures
            </span>
          ) : (
            <span>
              Free — 3 signatures/month.{" "}
              <button onClick={openUpgradePage} className="text-blue-500 hover:underline">
                Upgrade to Pro
              </button>
            </span>
          )}
        </p>
      </section>
    </div>
  )
}
