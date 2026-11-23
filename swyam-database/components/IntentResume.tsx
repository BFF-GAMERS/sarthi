import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { resolveCourseId, resolveOpportunityId } from "../lib/catalogue";
import { toggleSave } from "../lib/profile-data";
import { getOpportunity } from "../lib/opportunities";
import { trackSaved } from "@/evolution/runtime/tracker/save-event";
import { markResume, takeIntent } from "../lib/pending-intent";

/**
 * Finishes what somebody started before they signed in.
 *
 * Mounted once, at the root. It waits for a real session — not just a user
 * object, but the profile id every write needs — then carries out the one
 * intent that was left behind, and says so. A save is completed here. An
 * enrolment or an application is a decision with a fee or a cover note
 * attached, so it is not completed on somebody's behalf: the page is
 * re-opened with the panel ready and the person presses the button
 * themselves.
 */
export default function IntentResume() {
  const { user, profileId, ready } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!ready || !user || !profileId || done.current) return;
    const intent = takeIntent();
    if (!intent) return;
    done.current = true;

    const go = () => {
      if (window.location.pathname !== intent.path) void navigate({ to: intent.path });
    };

    if (intent.kind === "save-course" || intent.kind === "save-job") {
      const course = intent.kind === "save-course";
      void (async () => {
        try {
          const id = course
            ? await resolveCourseId(intent.slug)
            : await resolveOpportunityId(intent.slug);
          if (!id) throw new Error("not in the catalog");
          // An internship is saved as an internship, not as a job.
          const opening = course ? null : await getOpportunity(intent.slug).catch(() => null);
          const kind = course ? "course" : opening?.kind === "internship" ? "internship" : "job";
          await toggleSave(profileId, kind, id, false);
          trackSaved(kind, intent.slug);
          void qc.invalidateQueries({ queryKey: ["saves", profileId] });
          toast({
            title: `Saved — ${intent.title}`,
            body: "It was waiting from before you signed in.",
            action: { label: "See everything saved", to: "/saved" },
          });
        } catch {
          toast({
            tone: "info",
            title: "You are signed in",
            body: `We could not save ${intent.title} automatically. The Save button on its page will work now.`,
          });
        }
        go();
      })();
      return;
    }

    // Enrol / apply: take them back, and tell the page to open the panel.
    markResume(intent.kind, intent.slug);
    toast({
      tone: "info",
      title: "You are signed in",
      body:
        intent.kind === "enrol"
          ? `Picking up where you left off — ${intent.title}.`
          : `Your application to ${intent.title} is ready to send.`,
    });
    go();
  }, [ready, user, profileId, navigate, toast, qc]);

  return null;
}
