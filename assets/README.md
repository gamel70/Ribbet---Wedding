# Vendored assets

## GreatVibes-Latin.ttf

Great Vibes, the script face the guest app's home-screen icon is set in. It is
vendored rather than loaded through `next/font` because `ImageResponse` needs
raw font bytes, which `next/font` does not hand back.

Licensed under the SIL Open Font License 1.1 — see `GreatVibes-OFL.txt`, which
must travel with the font. Upstream: <https://github.com/google/fonts/tree/main/ofl/greatvibes>.

The shipped file is a Latin subset (40KB, down from 457KB) — `ImageResponse`
budgets 500KB for everything it renders, and the icon only ever sets names.
Regenerate with:

```bash
curl -L -o GreatVibes-Regular.ttf \
  https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf
pip install fonttools
python3 -m fontTools.subset GreatVibes-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2019,U+2013,U+2014,U+0026" \
  --layout-features='' --no-hinting --desubroutinize \
  --output-file=GreatVibes-Latin.ttf
```

Replacing the font means regenerating `SCRIPT_ADVANCES` in `src/lib/pwa.ts`, the
character-width table the icon measures names with. The command for that is in
the comment above the table.

`next.config.ts` force-includes this directory in the icon route's file trace;
nothing here is imported, so the bundler cannot see it on its own.
