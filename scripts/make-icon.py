"""Draws Notchy's icon source (1024 px) and the drag-out picture.

    python3 scripts/make-icon.py && npx tauri icon src-tauri/icons/source.png

The icon: a dark tile with the island at the top, a soft violet glow under
it, and the little status ring and clock the compact island shows.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"
S = 1024


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def island_path(draw: ImageDraw.ImageDraw, x0: float, y0: float, w: float, h: float, ear: float, r: float, fill):
    """The island: flat top glued to the edge, two concave ears, round bottom corners."""
    draw.rectangle((x0, y0, x0 + w, y0 + h - r), fill=fill)
    draw.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=r, fill=fill)
    # Ears: a square with a circle cut out of it, on each side of the top.
    draw.rectangle((x0 - ear, y0, x0, y0 + ear), fill=fill)
    draw.rectangle((x0 + w, y0, x0 + w + ear, y0 + ear), fill=fill)


def icon() -> Image.Image:
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Tile: a vertical gradient from deep violet-black to black.
    tile = Image.new("RGBA", (S, S))
    px = tile.load()
    for y in range(S):
        t = y / (S - 1)
        r = int(28 * (1 - t) + 8 * t)
        g = int(24 * (1 - t) + 8 * t)
        b = int(48 * (1 - t) + 14 * t)
        for x in range(S):
            px[x, y] = (r, g, b, 255)

    # Glow under the island.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((180, 250, 844, 640), fill=(124, 92, 255, 150))
    gd.ellipse((330, 330, 694, 560), fill=(56, 189, 248, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    tile = Image.alpha_composite(tile, glow)

    d = ImageDraw.Draw(tile)
    w, h, ear, r = 600, 230, 44, 115
    x0, y0 = (S - w) / 2, 0
    island_path(d, x0, y0, w, h, ear, r, (0, 0, 0, 255))
    # The ears' concave curve: circles of tile colour cut back out of the squares.
    ear_cut = Image.new("L", (S, S), 0)
    ed = ImageDraw.Draw(ear_cut)
    ed.ellipse((x0 - 2 * ear, y0, x0, y0 + 2 * ear), fill=255)
    ed.ellipse((x0 + w, y0, x0 + w + 2 * ear, y0 + 2 * ear), fill=255)
    background = Image.new("RGBA", (S, S))
    bpx = background.load()
    for y in range(int(2 * ear) + 2):
        t = y / (S - 1)
        col = (int(28 * (1 - t) + 8 * t), int(24 * (1 - t) + 8 * t), int(48 * (1 - t) + 14 * t), 255)
        for x in range(S):
            bpx[x, y] = col
    tile = Image.composite(background, tile, ear_cut)
    d = ImageDraw.Draw(tile)

    # Status ring and clock bar inside the island.
    cy = 115
    d.ellipse((x0 + 90, cy - 34, x0 + 158, cy + 34), outline=(52, 211, 153, 255), width=14)
    d.rounded_rectangle((x0 + 200, cy - 22, x0 + 420, cy + 22), radius=22, fill=(245, 246, 248, 255))
    d.ellipse((x0 + 462, cy - 22, x0 + 506, cy + 22), fill=(124, 92, 255, 255))

    base.paste(tile, (0, 0), rounded_mask(S, 228))
    return base


def drag_picture() -> Image.Image:
    """A small white document, what follows the cursor while a file is dragged out."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((12, 6, 52, 58), radius=7, fill=(245, 246, 248, 235))
    d.polygon([(40, 6), (52, 18), (40, 18)], fill=(190, 194, 204, 255))
    for i, y in enumerate((28, 36, 44)):
        d.rounded_rectangle((20, y, 44 - (i == 2) * 10, y + 3), radius=2, fill=(124, 92, 255, 255))
    return img


if __name__ == "__main__":
    ICONS.mkdir(parents=True, exist_ok=True)
    icon().save(ICONS / "source.png")
    drag_picture().save(ICONS / "drag.png")
    print("wrote", ICONS / "source.png", "and", ICONS / "drag.png")
