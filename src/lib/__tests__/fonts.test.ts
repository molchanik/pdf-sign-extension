import { describe, it, expect } from "vitest"
import { getFontDef, getVariantKey, FONTS } from "../fonts"

describe("getVariantKey", () => {
  it("returns normal-normal for no bold, no italic", () => {
    expect(getVariantKey(false, false)).toBe("normal-normal")
  })

  it("returns bold-normal for bold only", () => {
    expect(getVariantKey(true, false)).toBe("bold-normal")
  })

  it("returns normal-italic for italic only", () => {
    expect(getVariantKey(false, true)).toBe("normal-italic")
  })

  it("returns bold-italic for both", () => {
    expect(getVariantKey(true, true)).toBe("bold-italic")
  })
})

describe("getFontDef", () => {
  it("returns Helvetica font definition", () => {
    const font = getFontDef("Helvetica")
    expect(font).toBeDefined()
    expect(font!.isStandard).toBe(true)
    expect(font!.label).toBe("Helvetica")
  })

  it("returns Roboto font definition", () => {
    const font = getFontDef("Roboto")
    expect(font).toBeDefined()
    expect(font!.isStandard).toBe(false)
  })

  it("returns undefined for unknown font", () => {
    expect(getFontDef("Comic Sans")).toBeUndefined()
  })
})

describe("FONTS", () => {
  it("contains exactly 5 fonts", () => {
    expect(FONTS).toHaveLength(5)
  })

  it("has 3 standard and 2 custom fonts", () => {
    const standard = FONTS.filter(f => f.isStandard)
    const custom = FONTS.filter(f => !f.isStandard)
    expect(standard).toHaveLength(3)
    expect(custom).toHaveLength(2)
  })

  it("every font has all 4 variant keys", () => {
    const requiredKeys = ["normal-normal", "bold-normal", "normal-italic", "bold-italic"]
    for (const font of FONTS) {
      for (const key of requiredKeys) {
        expect(font.variants[key]).toBeDefined()
      }
    }
  })

  it("custom fonts have .ttf paths as variants", () => {
    const custom = FONTS.filter(f => !f.isStandard)
    for (const font of custom) {
      for (const path of Object.values(font.variants)) {
        expect(typeof path).toBe("string")
        expect(path).toMatch(/\.ttf$/)
      }
    }
  })
})
