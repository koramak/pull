# PULL — icon assets

Chosen direction: **gold core** (35b in the kit) — teal hull ring, four sections with masts, solid gold ore hexagon at r0.145.
Below 96px the ring becomes unbroken and the masts drop; the gold hexagon stays at every size.

## Files
| file | size | use |
| --- | --- | --- |
| `icon.svg` | 1024 | vector master |
| `icon-1024.png` | 1024 | store / master raster |
| `icon-512.png` | 512 | PWA |
| `icon-maskable-512.png` | 512 | PWA maskable, content at 68% |
| `icon-192.png` | 192 | PWA |
| `apple-touch-icon-180.png` | 180 | iOS home screen |
| `favicon-64.png` / `favicon-32.png` | 64 / 32 | browser tab |
| `splash-1170x2532.png` | 1170×2532 | iOS startup image |
| `manifest.webmanifest` | — | drop-in, paths assume `/assets/icon/` |

## Tokens used
`#05080d` field · `#5ef2d6` hull · `#ffe23f` ore · `#d8fff8` core white

Scanlines are baked in at 180 and above, 3px pitch, 30% black; omitted below.
No type in any asset — the wordmark is VT323 set live on the title screen.
