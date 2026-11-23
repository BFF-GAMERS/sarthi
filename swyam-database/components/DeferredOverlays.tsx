import KeyboardShortcuts from "./KeyboardShortcuts";
import PlusHost from "./membership/PlusHost";
import Onboarding from "./Onboarding";
import Tour from "./Tour";
import VoiceGuide from "./VoiceGuide";

/**
 * Everything on the page that draws nothing until it is needed, in one chunk.
 *
 * Onboarding alone drags the SkillSwap, coach, job-alert and company modules
 * in behind it, and the root route used to carry all of that for every
 * visitor on every page. The root now loads this file after the page is idle,
 * or the moment somebody starts using it, so the first paint is not waiting on
 * a first-visit dialog, a tour nobody has started or a voice mode nobody has
 * switched on. One component, one request: the four share most of their
 * dependencies.
 *
 * Swayam Plus queues behind the first-visit dialog and the tour: its trigger refuses to open while any
 * other modal, the tour or the adaptation notice is on screen, so only one overlay is ever up. The host
 * itself is a few hundred bytes; the sheet, card and price roll load the first time something opens them.
 *
 * Keyboard shortcuts stay available on the sign-in page, as before; the other
 * three belong to the site around it.
 */
export default function DeferredOverlays({ chrome }: { chrome: boolean }) {
  return (
    <>
      {chrome && (
        <>
          {/* Reads its own switch in Settings and does nothing until it is on. */}
          <VoiceGuide />
          {/* Shows itself only when the profile has never been set up —
              but never over the form that creates the profile. */}
          <Onboarding />
          {/* Draws nothing until somebody starts it. */}
          <Tour />
          {/* Watches for a good moment; opens the Plus sheet only when every quiet rule agrees. */}
          <PlusHost />
          {/* Chrome only: the say-it launcher draws its own button. */}
        </>
      )}
      {/* Keyboard-only; never draws anything. */}
      <KeyboardShortcuts />
    </>
  );
}
