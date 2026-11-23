import { track } from "@/evolution/runtime/tracker/track";
import { EV } from "@/evolution/config/ids";
import type { SectionProps } from "./types";

/** Header and "See all" links report which section was used, where it sat, and under which layout. */
export const sectionClick = (p: Pick<SectionProps, "id" | "position" | "layout">) => (): void =>
  track(EV.DASHBOARD_SECTION_CLICKED, { section: p.id, position: p.position, layout: p.layout });
