import React, { useEffect, useState } from "react"

import "~styles/globals.css"

function Popup() {
  const [iconUrl, setIconUrl] = useState("")

  useEffect(() => {
    // Plasmo hashes icon filenames; resolve via manifest
    const manifest = chrome.runtime.getManifest()
    const iconPath = (manifest.icons as Record<string, string>)?.["128"]
      || (manifest.icons as Record<string, string>)?.["48"]
      || ""
    if (iconPath) setIconUrl(chrome.runtime.getURL(iconPath))
  }, [])

  const handleOpen = () => {
    chrome.tabs.create({ url: "./tabs/editor.html" })
    window.close()
  }

  return (
    <div style={{ width: 300, padding: 24 }} className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        {iconUrl ? <img src={iconUrl} alt="PDF Sign" className="w-8 h-8" /> : <div className="w-8 h-8" />}
        <h1 className="text-lg font-bold text-gray-800">PDF Sign</h1>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Sign PDF documents locally — no upload required
      </p>
      <button onClick={handleOpen} className="btn-primary w-full py-3 text-base">
        Open PDF Editor
      </button>
    </div>
  )
}

export default Popup
