"""Generate the Phase-1c stress-test PDF corpus for SafePDFSign.

Each fixture targets one edge case the editor flow may hit. The runner
script (run.mjs) replays the extension's load path on every fixture and
reports observed behavior; this generator only produces the inputs.

Run with:
    python scripts/show-hn-stress/generate.py

Outputs land in scripts/show-hn-stress/corpus/.
"""

from __future__ import annotations

import io
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    RectangleObject,
    TextStringObject,
)
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

CORPUS = Path(__file__).resolve().parent / "corpus"
CORPUS.mkdir(exist_ok=True)


def base_letter_pdf(
    pages: int = 1,
    title: str = "Stress fixture",
    fill_text: str | None = None,
) -> bytes:
    """Plain Latin-1 PDF with N pages of body text — the control sample."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    c.setTitle(title)
    for n in range(1, pages + 1):
        c.setFont("Helvetica", 16)
        c.drawString(72, 720, f"{title} — page {n} of {pages}")
        c.setFont("Helvetica", 11)
        body = fill_text or (
            "This page exists to give the renderer something to lay out. "
            "It contains only WinAnsi-encodable Latin characters so the "
            "extension's Helvetica path can render it without complaint."
        )
        text = c.beginText(72, 690)
        for line in (body * 6).split(". "):
            text.textLine(line[:90])
        c.drawText(text)
        c.showPage()
    c.save()
    return buf.getvalue()


def write(name: str, data: bytes) -> None:
    out = CORPUS / name
    out.write_bytes(data)
    print(f"  {name:<32} {len(data):>10,} bytes")


def gen_encrypted_user_password() -> None:
    """User password = 'open-me'. Reader must supply it before viewing.

    The extension uses pdf-lib's `ignoreEncryption: true` for upload
    (FileDropzone) but plain `PDFDocument.load` for the sign step — we
    expect the upload to succeed and the sign-time load to throw.
    """
    base = base_letter_pdf(pages=2, title="Encrypted user-password fixture")
    writer = PdfWriter(clone_from=io.BytesIO(base))
    writer.encrypt(user_password="open-me", owner_password="own-me", algorithm="AES-128")
    out = io.BytesIO()
    writer.write(out)
    write("encrypted-user-password.pdf", out.getvalue())


def gen_encrypted_owner_only() -> None:
    """Owner-only password (no user password) — viewer can read freely.

    User-password is the empty string, so any reader opens it without
    prompting. Owner permissions still restrict copy/print/modify. We
    expect the extension to load and render this fine; signing depends on
    whether pdf-lib refuses to re-write owner-protected PDFs.
    """
    base = base_letter_pdf(pages=2, title="Encrypted owner-only fixture")
    writer = PdfWriter(clone_from=io.BytesIO(base))
    writer.encrypt(user_password="", owner_password="own-me", algorithm="AES-128")
    out = io.BytesIO()
    writer.write(out)
    write("encrypted-owner-only.pdf", out.getvalue())


def gen_501_pages() -> None:
    """501 small pages — exercises pdf-lib's page-count handling.

    We do NOT also test the 50 MB hard limit here; that is a single-line
    `if (file.size > 50 * 1024 * 1024)` check in FileDropzone, so the
    behavior is mechanical. Page-count stress is the more interesting
    failure surface.
    """
    write(
        "large-501-pages.pdf",
        base_letter_pdf(pages=501, title="501-page fixture", fill_text="Lorem ipsum."),
    )


def gen_acroform() -> None:
    """A two-page PDF with a text-input field whose value is pre-filled.

    The question for Phase 1c: does pdf-lib re-save preserve the form
    field value, or does the overlay flow flatten/strip the field?
    """
    base = base_letter_pdf(pages=1, title="AcroForm fixture")
    reader_writer = PdfWriter(clone_from=io.BytesIO(base))
    page = reader_writer.pages[0]

    field = DictionaryObject(
        {
            NameObject("/T"): TextStringObject("FullName"),
            NameObject("/FT"): NameObject("/Tx"),
            NameObject("/V"): TextStringObject("Pre-filled by generator"),
            NameObject("/DV"): TextStringObject("Pre-filled by generator"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/Rect"): RectangleObject([72, 600, 400, 630]),
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/F"): NumberObject(4),
            NameObject("/P"): page.indirect_reference,
            NameObject("/Ff"): NumberObject(0),
            NameObject("/DA"): TextStringObject("/Helv 12 Tf 0 g"),
        }
    )
    field_ref = reader_writer._add_object(field)

    page[NameObject("/Annots")] = ArrayObject([field_ref])

    acroform = DictionaryObject(
        {
            NameObject("/Fields"): ArrayObject([field_ref]),
            NameObject("/NeedAppearances"): BooleanObject(True),
        }
    )
    reader_writer._root_object[NameObject("/AcroForm")] = acroform

    out = io.BytesIO()
    reader_writer.write(out)
    write("acroform-prefilled.pdf", out.getvalue())


def gen_image_only_scan() -> None:
    """Single-page PDF whose only content is a raster image — no text.

    Mimics a phone-camera scan: the editor cannot extract any text from
    this, but rendering and overlay-signing should still work.
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    c.setTitle("Image-only scan fixture")
    # Build a tiny on-the-fly raster: a single 200x100 dark rectangle
    # filled in via reportlab's vector ops, then capture as image-only by
    # rendering it inside an XObject. Easier path: draw a filled rect that
    # spans most of the page; reportlab serialises this as graphics ops,
    # which is *not* a text run, so any text-layer extractor sees nothing.
    c.setFillColorRGB(0.18, 0.18, 0.18)
    c.rect(72, 200, 6.5 * 72, 6 * 72, fill=True, stroke=False)
    c.setFillColorRGB(0.9, 0.9, 0.9)
    # Drawing a label as an outlined path so it has no /Text run.
    c.setFontSize(0)  # hides any subsequent drawString from extraction
    c.showPage()
    c.save()
    write("image-only-scan.pdf", buf.getvalue())


def gen_already_overlaid() -> None:
    """A PDF that already has a 'baked-in' signature image overlay.

    Used to check whether re-signing a previously-signed file works
    (pdf-lib reads, adds new overlays, re-saves).
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    c.setTitle("Already-signed fixture")
    c.setFont("Helvetica", 16)
    c.drawString(72, 720, "Already-signed fixture")
    c.setFont("Helvetica", 11)
    c.drawString(72, 690, "This page already carries an overlay drawn at generation time.")
    c.setStrokeColorRGB(0.7, 0.1, 0.1)
    c.setLineWidth(2.0)
    # Fake hand-drawn signature stroke
    c.bezier(150, 200, 220, 260, 280, 180, 360, 220)
    c.bezier(360, 220, 400, 260, 440, 200, 480, 240)
    c.setFont("Helvetica-Oblique", 10)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawString(150, 180, "(prior overlay)")
    c.showPage()
    c.save()
    write("already-overlaid.pdf", buf.getvalue())


if __name__ == "__main__":
    print(f"Writing fixtures to {CORPUS}/")
    gen_encrypted_user_password()
    gen_encrypted_owner_only()
    gen_501_pages()
    gen_acroform()
    gen_image_only_scan()
    gen_already_overlaid()
    print(f"\nDone. {len(list(CORPUS.glob('*.pdf')))} fixtures.")
