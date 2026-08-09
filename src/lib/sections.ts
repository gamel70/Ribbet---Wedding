import type { SectionKey, SectionMetaMap, Sections } from "@/db/schema";
import { SECTION_DEFS } from "@/lib/design";

/**
 * Section names and running order, after the couple console has had its say.
 *
 * "The couple can rename, reorder, or hide any of these — a section they skip
 * never shows" is a promise screen 05 makes to guests, so both the More grid and
 * the tab bar read from here rather than from SECTION_DEFS directly.
 */
export type ResolvedSection = {
  key: SectionKey;
  label: string;
  sub: string;
  locked: boolean;
  on: boolean;
  order: number;
};

export function resolveSectionList(
  sections: Sections,
  meta: SectionMetaMap | null | undefined,
): ResolvedSection[] {
  return SECTION_DEFS.map((def, i) => {
    const override = meta?.[def.key];
    return {
      key: def.key,
      label: override?.label?.trim() || def.label,
      sub: def.sub,
      locked: def.locked,
      on: def.locked ? true : sections[def.key],
      order: typeof override?.order === "number" ? override.order : i,
    };
  }).sort((a, b) => a.order - b.order);
}

/** Just the label, for screens that render one section on its own. */
export function sectionLabel(key: SectionKey, meta: SectionMetaMap | null | undefined): string {
  const override = meta?.[key]?.label?.trim();
  if (override) return override;
  return SECTION_DEFS.find((d) => d.key === key)?.label ?? key;
}
