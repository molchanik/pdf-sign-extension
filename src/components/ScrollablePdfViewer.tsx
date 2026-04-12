import React, { useCallback, useEffect, useRef, useState } from "react"

import { PdfDocumentRenderer, type RenderResult } from "~lib/pdf-renderer"

import { PageIndicator } from "./PageIndicator"

export interface PageInfo {
  rendered: boolean
  scale: number
  width: number
  height: number
}

interface ScrollablePdfViewerProps {
  pdfBytes: ArrayBuffer
  pageCount: number
  onPageClick?: (pageIndex: number, x: number, y: number, scale: number) => void
  currentPage: number
  onCurrentPageChange: (page: number) => void
  pageScalesRef: React.MutableRefObject<Map<number, number>>
  children?: (pageIndex: number, pageInfo: PageInfo | null) => React.ReactNode
}

export function ScrollablePdfViewer({
  pdfBytes,
  pageCount,
  onPageClick,
  currentPage,
  onCurrentPageChange,
  pageScalesRef,
  children,
}: ScrollablePdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const wrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [pageInfos, setPageInfos] = useState<Map<number, PageInfo>>(new Map())
  const renderedSet = useRef<Set<number>>(new Set())
  const rendererRef = useRef<PdfDocumentRenderer | null>(null)

  // Create/destroy renderer when pdfBytes changes
  useEffect(() => {
    rendererRef.current = new PdfDocumentRenderer(pdfBytes)
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [pdfBytes])

  const renderPageAt = useCallback(async (pageIndex: number) => {
    if (renderedSet.current.has(pageIndex)) return
    const canvas = canvasRefs.current.get(pageIndex)
    if (!canvas) return
    const wrapper = wrapperRefs.current.get(pageIndex)
    if (!wrapper) return
    const renderer = rendererRef.current
    if (!renderer) return

    renderedSet.current.add(pageIndex)
    const containerWidth = wrapper.clientWidth

    try {
      const result: RenderResult = await renderer.renderPage(pageIndex, canvas, containerWidth)
      const info: PageInfo = {
        rendered: true,
        scale: result.scale,
        width: result.pageWidth,
        height: result.pageHeight,
      }
      setPageInfos(prev => new Map(prev).set(pageIndex, info))
      pageScalesRef.current.set(pageIndex, result.scale)
    } catch (err) {
      console.error(`Failed to render page ${pageIndex}:`, err)
      renderedSet.current.delete(pageIndex)
    }
  }, [pdfBytes, pageScalesRef])

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-page-index"))
            if (!isNaN(idx)) renderPageAt(idx)
          }
        }
      },
      { root: scrollEl, rootMargin: "200px 0px" }
    )

    wrapperRefs.current.forEach((wrapper) => {
      observer.observe(wrapper)
    })

    return () => observer.disconnect()
  }, [pageCount, renderPageAt])

  // Track current page on scroll
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const scrollMid = scrollEl.scrollTop + scrollEl.clientHeight / 2
      let cumulative = 0
      for (let i = 0; i < pageCount; i++) {
        const wrapper = wrapperRefs.current.get(i)
        if (!wrapper) continue
        const h = wrapper.offsetHeight + 12
        if (cumulative + h > scrollMid) {
          if (i + 1 !== currentPage) onCurrentPageChange(i + 1)
          break
        }
        cumulative += h
      }
    }

    scrollEl.addEventListener("scroll", handleScroll, { passive: true })
    return () => scrollEl.removeEventListener("scroll", handleScroll)
  }, [pageCount, currentPage, onCurrentPageChange])

  const handlePageClick = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPageClick) return
    if ((e.target as HTMLElement).closest("[data-element-overlay]")) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const scale = pageScalesRef.current.get(pageIndex) || 1
    onPageClick(pageIndex, x, y, scale)
  }

  return (
    <div ref={scrollRef} className="editor-pdf-area">
      <div className="flex flex-col items-center gap-3 py-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const info = pageInfos.get(i)
          return (
            <div
              key={i}
              data-page-index={i}
              ref={(el) => { if (el) wrapperRefs.current.set(i, el); else wrapperRefs.current.delete(i) }}
              className="relative bg-white shadow-sm"
              style={info ? undefined : { aspectRatio: "1 / 1.414", width: "calc(100% - 32px)" }}
              onClick={(e) => handlePageClick(i, e)}
            >
              <canvas
                ref={(el) => { if (el) canvasRefs.current.set(i, el); else canvasRefs.current.delete(i) }}
                className="block"
              />
              {!info && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                  Page {i + 1}
                </div>
              )}
              {children?.(i, info || null)}
            </div>
          )
        })}
      </div>
      <PageIndicator currentPage={currentPage} totalPages={pageCount} />
    </div>
  )
}
