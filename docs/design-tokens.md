# Design tokens and how to use them

This file documents the new design tokens introduced for the visual rebrand.

Location

How it works

Fonts

How to fetch the Google Fonts used by the original design
- A small helper script is provided to download the `woff2` files from Google Fonts into `www/assets/fonts`.
- Run from the project root:

```bash
npm run fetch-fonts
```

If you want a different Google Fonts URL, pass it as an argument:

```bash
node scripts/fetch-fonts.js "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
```

After downloading, either rename the downloaded files to match the `@font-face` declarations in `www/css/design-tokens.css` or update those declarations to point at the downloaded filenames.
Notes
- We intentionally keep the old CSS variables as fallbacks so the rest of the CSS continues to work while migration proceeds.
