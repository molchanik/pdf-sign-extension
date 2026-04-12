import React, { useEffect, useRef, useState } from "react"

interface PageIndicatorProps {
  currentPage: number
  totalPages: number
}

export function PageIndicator({ currentPage, totalPages }: PageIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 1500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentPage])

  return (
    <div
      className={`
        absolute bottom-4 left-1/2 -translate-x-1/2 z-10
        bg-black/70 text-white text-xs px-3 py-1.5 rounded-full
        transition-opacity duration-300 pointer-events-none
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      Page {currentPage} of {totalPages}
    </div>
  )
}
