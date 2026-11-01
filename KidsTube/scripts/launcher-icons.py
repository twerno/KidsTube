#!/usr/bin/env python3
"""Generuje ikonę launchera Androida z `docs/icon.png` (jedyne źródło grafiki).

Wynik (res/):
  mipmap-anydpi-v26/ic_launcher.xml        adaptive icon (tło = kolor, wierzch = PNG)
  mipmap-xxxhdpi/ic_launcher_foreground.png  108dp canvas @4x, grafika w strefie bezpiecznej
  values/colors.xml                        kolor tła (spójny z gradientem grafiki)

minSdk 26, więc nie ma warstwy legacy (żadnych ręcznie robionych `ic_launcher.png`
w gęstościach) — launcher zawsze maskuje adaptive icon.

Użycie: python3 KidsTube/scripts/launcher-icons.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "icon.png"
RES = ROOT / "KidsTube" / "android" / "app" / "src" / "main" / "res"

CANVAS = 432  # 108dp @ xxxhdpi
ART = 288  # 72dp — strefa bezpieczna adaptive icon (66% płótna)


def lerp(a: tuple[int, ...], b: tuple[int, ...], t: float) -> tuple[int, ...]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    w, h = src.size

    # Kolory krawędzi grafiki -> pionowy gradient wypełniający płótno poza nią.
    top = src.getpixel((w // 2, 1))[:3]
    bottom = src.getpixel((w // 2, h - 2))[:3]

    canvas = Image.new("RGBA", (CANVAS, CANVAS))
    pixels = canvas.load()
    for y in range(CANVAS):
        color = lerp(top, bottom, y / (CANVAS - 1))
        for x in range(CANVAS):
            pixels[x, y] = (*color, 255)

    art = src.resize((ART, ART), Image.LANCZOS)
    offset = (CANVAS - ART) // 2
    canvas.alpha_composite(art, (offset, offset))

    xhdpi = RES / "mipmap-xxxhdpi"
    xhdpi.mkdir(parents=True, exist_ok=True)
    canvas.save(xhdpi / "ic_launcher_foreground.png", optimize=True)

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        "</adaptive-icon>\n"
    )

    mid = lerp(top, bottom, 0.5)
    (RES / "values" / "colors.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">#{mid[0]:02X}{mid[1]:02X}{mid[2]:02X}</color>\n'
        "</resources>\n"
    )

    # Sprzątanie starych, ręcznie robionych warstw ikony.
    for stale in [
        *RES.glob("mipmap-*/ic_launcher.png"),
        *RES.glob("mipmap-*/ic_launcher_round.png"),
        *RES.glob("mipmap-*/ic_launcher_foreground.png"),
        RES / "mipmap-anydpi-v26" / "ic_launcher_round.xml",
    ]:
        if stale.name == "ic_launcher_foreground.png" and stale.parent.name == "mipmap-xxxhdpi":
            continue
        if stale.exists():
            stale.unlink()
            print(f"usunięto {stale.relative_to(ROOT)}")

    print(f"ikona: {SOURCE.relative_to(ROOT)} -> {xhdpi.relative_to(ROOT)}/ic_launcher_foreground.png")


if __name__ == "__main__":
    main()
