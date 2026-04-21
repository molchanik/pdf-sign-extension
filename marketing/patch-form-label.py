"""Patch product-form-filled.png — replace 'Printed name' label with 'Signature'."""
from PIL import Image, ImageDraw, ImageFont

SRC = 'D:/GIT/SignPDF/marketing/assets/product-form-filled.png'
DST = 'D:/GIT/SignPDF/marketing/assets/product-form-filled-edited.png'

img = Image.open(SRC).convert('RGB')
draw = ImageDraw.Draw(img)

# Background color of form area (sampled: 225,225,225)
BG = (225, 225, 225)
# Label text color — sampled darkest pixel from 'Model' text
TEXT = (75, 75, 75)

# Cover "Printed name" region — extend bounds on all sides to avoid artefacts
draw.rectangle([(25, 228), (175, 260)], fill=BG)

# Load Segoe UI at size matching 'Model' (cap height ~18px ≈ font size 22)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)

# Draw 'Signature' — top-aligned to where 'Printed name' started (y=236)
draw.text((40, 232), 'Signature', font=font, fill=TEXT)

img.save(DST)
print(f'Saved: {DST}')
