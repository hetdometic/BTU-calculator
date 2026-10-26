# Site icons

Favicon and app icons use the Dometic mark from the header logo in `index.html`, white on the page's ink colour (`#0d0d0d`).

| File | Size | Use |
| --- | --- | --- |
| [icon.svg](icon.svg) | scalable | Browser-tab favicon: rounded square, mark about 72% of the width |
| [favicon.ico](../../favicon.ico) | 16, 32 and 48 px | Fallback favicon for browsers without SVG favicon support |
| [apple-touch-icon.png](apple-touch-icon.png) | 180 px | iOS home screen: full-bleed square; iOS rounds the corners |
| [icon-192.png](icon-192.png), [icon-512.png](icon-512.png) | 192 and 512 px | [Web manifest](../../site.webmanifest) icons; the mark stays inside the maskable safe zone |

The PNG and ICO files were rendered from these shapes with headless Chrome on 2026-10-26. The full-bleed variant is the same mark with `translate(13 20.45) scale(0.96254)` on a 64 × 64 square without rounded corners. To change the icon, edit both variants and re-render every size; `npm test` checks that each declared icon exists at its stated size.
