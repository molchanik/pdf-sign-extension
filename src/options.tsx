import React, { useEffect, useState } from "react"

import { getSession, signInWithGoogle, signOut } from "~lib/auth"
import { checkProStatus, openUpgradePage, type ProStatus } from "~lib/payments"
import { deleteSignature, loadSignature } from "~lib/storage"

import "~styles/globals.css"

export default function Options() {
  const [savedSig, setSavedSig] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [proStatus, setProStatus] = useState<ProStatus | null>(null)

  useEffect(() => {
    loadSignature().then(setSavedSig)
    getSession().then((s) => setEmail(s?.user?.email ?? null))
    checkProStatus().then(setProStatus)
  }, [])

  const handleDeleteSignature = async () => {
    await deleteSignature()
    setSavedSig(null)
  }

  const handleSignIn = async () => {
    await signInWithGoogle()
    const s = await getSession()
    setEmail(s?.user?.email ?? null)
    const status = await checkProStatus()
    setProStatus(status)
  }

  const handleSignOut = async () => {
    await signOut()
    setEmail(null)
    setProStatus(null)
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
            No saved signature. Draw one in the editor and save it.
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
        <div className="text-sm text-gray-600">
          {proStatus?.paid ? (
            <div>
              <span className="text-blue-600 font-medium">Pro — Unlimited files</span>
              {proStatus.subscriptionCancelAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Active until {new Date(proStatus.subscriptionCancelAt).toLocaleDateString()}
                </p>
              )}
              <button onClick={openUpgradePage} className="text-xs text-gray-400 hover:underline mt-1 block">
                Manage subscription
              </button>
            </div>
          ) : (
            <span>
              Free — 1 file.{" "}
              <button onClick={openUpgradePage} className="text-blue-500 hover:underline">
                Upgrade to Pro
              </button>
            </span>
          )}
        </div>
      </section>
    </div>
  )
}
