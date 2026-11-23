import { CheckCircle2 } from "lucide-react";
import { usePacks } from "../../lib/offline/store";
import { useTx } from "../../lib/i18n";

/**
 * "Available offline" chip for a course whose lesson pack is on this device.
 *
 * Renders nothing on the server, before hydration, while the pack list is still
 * being read, or when no pack is stored, so a course card is never decorated on
 * a guess. Icon and words together: the state is not carried by colour alone.
 */
export default function OfflineBadge({
  courseSlug,
  className = "",
}: {
  courseSlug: string;
  className?: string;
}) {
  const tx = useTx();
  const { packs } = usePacks();
  if (!packs.some((p) => p.courseSlug === courseSlug)) return null;
  return (
    <span className={`offline-badge ${className}`.trim()} data-offline-badge={courseSlug}>
      <CheckCircle2 size={12} aria-hidden />
      {tx("Available offline")}
    </span>
  );
}
