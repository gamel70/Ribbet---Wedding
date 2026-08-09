import type { CSSProperties } from "react";

import type { Layout, Palette } from "@/db/schema";
import { LAYOUTS, accentInk, resolveAccent } from "@/lib/design";

/**
 * The couple's look, expressed as CSS custom properties on the guest app's root.
 *
 * `Ribbet App Structure.dc.html` themes all twelve screens from one token set,
 * so the guest app does the same: every screen reads var(--acc), var(--panel)
 * and friends rather than being handed colours prop by prop. Change the layout
 * or palette in the intake and the whole app follows.
 */
export type GuestTheme = {
  vars: CSSProperties;
  accent: string;
  accentInk: string;
  layout: Layout;
};

export function guestTheme(input: {
  layout: Layout;
  palette: Palette;
  accent: string | null;
}): GuestTheme {
  const l = LAYOUTS[input.layout] ?? LAYOUTS.botanical;
  const accent = resolveAccent(input.palette, input.accent);
  const ink = accentInk(accent);

  return {
    layout: input.layout,
    accent,
    accentInk: ink,
    vars: {
      "--bg": l.bg,
      "--panel": l.panel,
      "--line": l.line,
      "--ink": l.ink,
      "--mut": l.mut,
      "--serif": l.serif,
      "--rad": l.rad,
      "--acc": accent,
      "--acc-ink": ink,
    } as CSSProperties,
  };
}
