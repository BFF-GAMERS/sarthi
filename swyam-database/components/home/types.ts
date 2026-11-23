import type { Density, HomeLayout, SectionId, UIDisplay } from "@/evolution/types";

/** What the renderer hands every section. Sections read it; none of it is paint. */
export interface SectionProps {
  id: SectionId;
  variant: Density;
  display: UIDisplay;
  /** 1-based place in the rendered list, for dashboard_section_clicked. */
  position: number;
  layout: HomeLayout;
  signedIn: boolean;
  /** True only in the universal order: the pinned course rail runs there and nowhere else. */
  defaultSlot: boolean;
}

/** Items shown before "See all": compact trims to 3, research widens to 6 (display.itemsPerSection). */
export const limitOf = (p: Pick<SectionProps, "display" | "variant">): number =>
  p.variant === "compact" ? Math.min(3, p.display.itemsPerSection) : p.display.itemsPerSection;
