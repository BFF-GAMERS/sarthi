import { Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { useTx } from "../lib/i18n";

/**
 * The two documents a platform holding people's data owes them.
 *
 * Written from the code rather than from a template. Every third party named
 * below appears because something in `src/` actually calls it, every stored
 * item because something actually writes it, and the section saying there is
 * no advertising and no third-party tracking is there because a search of the
 * source for gtag, analytics, posthog, mixpanel, segment, hotjar and
 * document.cookie returns nothing. The one thing that does watch what you do
 * is Swayam's own Evolution Engine, which keeps a behaviour profile on your
 * device; section 01 and section 02 say so. A policy that describes a different product is not a
 * protection; it is a second thing to be caught out on.
 *
 * NOT LEGAL ADVICE. This is an accurate description of what the software
 * does, in plain words, which is the part an engineer can supply. Whether it
 * satisfies the Digital Personal Data Protection Act 2023 is a question for
 * somebody qualified to answer it, and it should be read by one before the
 * site takes real members.
 */

/*
 * The DPDP Act requires a published grievance contact. There is no such
 * address anywhere in this repository, and inventing one would be worse than
 * leaving it visibly blank — a person with a complaint would write to nobody.
 * Fill this in before launch and the pages stop saying it is missing.
 */
const GRIEVANCE_EMAIL: string | null = null;

const UPDATED = "25 September 2026";

function Doc({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  const tx = useTx();
  return (
    <div className="container-x pb-24 pt-28">
      <Reveal>
        <p className="datum">
          {tx("Last updated")} · {UPDATED}
        </p>
        <h1 className="section-title mt-3">{title}</h1>
        <p className="mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-ink-soft">{lede}</p>
      </Reveal>
      <div className="mt-10 max-w-2xl">{children}</div>
      <Reveal>
        <p className="mt-12 max-w-2xl border-t border-ink-line pt-5 font-body text-[12.5px] leading-relaxed text-ink-mute">
          {tx(
            "This describes what the software does. It has not been reviewed by a lawyer, and it is not legal advice.",
          )}
        </p>
      </Reveal>
    </div>
  );
}

function S({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section className="mt-9 first:mt-0">
        <h2 className="flex items-baseline gap-2.5 font-display text-lg tracking-tight text-ink">
          <span className="font-mono text-[12px] tabular-nums text-ink-mute">{n}</span>
          {title}
        </h2>
        <div className="mt-2.5 flex flex-col gap-2.5 font-body text-[14px] leading-relaxed text-ink-soft">
          {children}
        </div>
      </section>
    </Reveal>
  );
}

/** A row in the "who else sees this" table — named, with the reason. */
function Third({ who, what, why }: { who: string; what: string; why: string }) {
  return (
    <li className="border-t border-ink-line py-2.5">
      <p className="font-body text-[13.5px] font-semibold text-ink">{who}</p>
      <p className="font-body text-[13px] text-ink-soft">{what}</p>
      <p className="font-body text-[12.5px] text-ink-mute">{why}</p>
    </li>
  );
}

function Grievance() {
  const tx = useTx();
  if (GRIEVANCE_EMAIL) {
    return (
      <a
        href={`mailto:${GRIEVANCE_EMAIL}`}
        className="text-saffron-700 underline-offset-2 hover:underline"
      >
        {GRIEVANCE_EMAIL}
      </a>
    );
  }
  return (
    <Link to="/contact" className="text-saffron-600 underline">
      {tx("us through the Contact page")}
    </Link>
  );
}

export function Privacy() {
  const tx = useTx();
  return (
    <Doc
      title={tx("Privacy")}
      lede={tx(
        "What this site keeps about you, who else sees it, and what you can make us do with it. Written from how the site actually works, not from a template.",
      )}
    >
      <S n="01" title={tx("What we keep")}>
        <p>
          {tx(
            "Your account: the name and email you signed up with, your handle, and anything you chose to add — a photo, a headline, a region, languages, a short bio.",
          )}
        </p>
        <p>
          {tx(
            "What you do here: courses you enroll in and how far you get, jobs and internships you apply to and the state each application reaches, skills you list, certificates you earn, posts and replies you write, messages you send, items you save or compare, and who you follow.",
          )}
        </p>
        <p>
          {tx(
            "Sent to the AI for that request only, and not stored: a CV you paste in for review and the answers you give the scheme checker. Each is sent to the AI model to produce your result and is not written anywhere by स्वYAM.",
          )}
        </p>
        <p>
          {tx(
            "On your device: settings such as your language, interface mode and accessibility choices, your cart, your comparison list and your recent searches. These sit in your browser's local storage, not on our servers, and clearing your browser data removes them.",
          )}
        </p>
        <p>
          {tx(
            "Your behavior profile, on your device: स्वYAM learns from what you do here, such as which courses, jobs, skills and community pages you open, search or save. It keeps a short log of those actions and a few scores derived from them in your browser's local storage, and uses them to arrange the navigation and the home page. It is not stored with your name, and no sensitive attribute (your age, region, gender, religion, caste, health or the like) is used to decide anything.",
          )}
        </p>
        <p>
          {tx(
            "Optional account sync: if you are signed in, aggregate scores and the current arrangement, never the log of individual actions, may be saved to your account so another device of yours looks the same. This is never done for anyone under 18; for them the profile stays on the device.",
          )}
        </p>
        <p>
          {tx(
            "Your controls: Reset my experience clears the profile and the arrangement, Keep my current layout freezes the arrangement while learning continues, and you can switch adapting off entirely. They are in the “Your स्वYAM” panel, in Settings and in the Evolution Lab.",
          )}
        </p>
      </S>

      <S n="02" title={tx("What we do not do")}>
        <p>
          {tx(
            "This site sets no cookies of its own, runs no third-party analytics, and carries no advertising or tracking pixels. We do not sell, rent or share your data with advertisers or data brokers. There is no third-party script on any page whose purpose is to watch you. The only thing that learns from your activity is स्वYAM's own behavior profile, described above, which stays on your device unless you turn on account sync.",
          )}
        </p>
      </S>

      <S n="03" title={tx("Who else sees it, and why")}>
        <ul className="mt-1">
          <Third
            who="Supabase"
            what={tx("Your account and everything you create here are stored in its database.")}
            why={tx(
              "It is where this site's data lives. Access is restricted per row, per account.",
            )}
          />
          <Third
            who={tx("Google (Gemini)")}
            what={tx(
              "The text of what you ask the assistant, a CV you submit for review, and your coaching questions. When the optional AI check of your layout is enabled, it also receives an anonymous summary of which sections you use, with no name, no account and no individual actions, to help arrange the interface.",
            )}
            why={tx(
              "It writes the answers, suggests an arrangement, and translates the text on a page when you choose a language other than English. Private pages such as Messages are never sent for translation. Do not paste anything into it you would not send to a third party.",
            )}
          />
          <Third
            who={tx("Sarvam AI")}
            what={tx("Your speech, and your phone number if you ask Sarthi to call you.")}
            why={tx("It provides the Indian-language voice and the phone line.")}
          />
          <Third
            who="Adzuna"
            what={tx(
              "Nothing about you — only the search words, if you filter the outside listings.",
            )}
            why={tx("It supplies the openings listed under “Also open elsewhere”.")}
          />
          <Third
            who="Resend"
            what={tx("Your email address and the contents of mail this site sends you.")}
            why={tx("It delivers the email.")}
          />
          <Third
            who="Vercel"
            what={tx("Ordinary server request information, including your IP address.")}
            why={tx("It hosts the site.")}
          />
        </ul>
      </S>

      <S n="04" title={tx("How long")}>
        <p>
          {tx(
            "Your account and what you created stay until you delete them or ask us to. Delete a post and it is gone. Close your account and the profile, applications, messages and saved items go with it.",
          )}
        </p>
        <p>
          {tx(
            "Two things outlive that on purpose: a certificate's verification record, so an employer checking a serial you already gave them does not hit a dead page; and moderation records of reports and blocks, so somebody removed for harming others cannot clear it by leaving and returning.",
          )}
        </p>
      </S>

      <S n="05" title={tx("What you can make us do")}>
        <p>
          {tx(
            "Under the Digital Personal Data Protection Act, 2023, you may ask for a copy of what we hold about you, ask us to correct anything wrong, ask us to erase it, withdraw a consent you gave, and nominate someone to exercise these on your behalf if you cannot.",
          )}
        </p>
        <p>
          {tx("To raise a grievance, write to")} <Grievance />.{" "}
          {tx(
            "If we have not dealt with it properly you may complain to the Data Protection Board of India.",
          )}
        </p>
        <p>
          <Link to="/contact" className="text-saffron-700 underline-offset-2 hover:underline">
            {tx("Contact form")}
          </Link>
          {" · "}
          <Link to="/trust" className="text-saffron-700 underline-offset-2 hover:underline">
            {tx("Trust center")}
          </Link>
        </p>
      </S>

      <S n="06" title={tx("Children")}>
        <p>
          {tx(
            "This site is built for learners including school students. Where the law requires a parent or guardian's consent for someone under 18, that consent is the account holder's responsibility. We do not show advertising to anyone, and we do not build profiles of children for anyone else's use. The on-device behavior profile arranges the site for every learner, but it is never synced to our servers for anyone under 18.",
          )}
        </p>
      </S>

      <S n="07" title={tx("Changes")}>
        <p>
          {tx(
            "If this changes in a way that affects you, the date at the top changes and the new version is what applies. We will not quietly start doing something this page says we do not do.",
          )}
        </p>
      </S>
    </Doc>
  );
}

export function Terms() {
  const tx = useTx();
  return (
    <Doc
      title={tx("Terms of use")}
      lede={tx(
        "The rules for using स्वYAM, and — more importantly — what this platform does not promise you.",
      )}
    >
      <S n="01" title={tx("What this is")}>
        <p>
          {tx(
            "स्वYAM lists courses, apprenticeships, internships and jobs, issues certificates for assessments taken here, and lets members teach and learn from each other. Using it means accepting these terms.",
          )}
        </p>
        <p>
          {tx(
            "The navigation and the home page rearrange themselves around what you do here, using a behavior profile kept on your device. Every feature stays reachable, nothing is hidden for good, and no sensitive attribute is used. You can use Reset my experience or Keep my current layout at any time, and the Evolution Lab shows what it learned. How that data is handled is explained on the Privacy page.",
          )}
        </p>
      </S>

      <S n="02" title={tx("Your account")}>
        <p>
          {tx(
            "One account per person, with details that are true. You are responsible for what is done through it. Tell us if you think someone else has accessed your account.",
          )}
        </p>
      </S>

      <S n="03" title={tx("What you post")}>
        <p>
          {tx(
            "What you write stays yours. By posting it here you allow us to display it on the platform. You may delete your own posts, and deleting one removes it.",
          )}
        </p>
        <p>
          {tx(
            "Do not post anything unlawful, abusive, misleading about your qualifications, or belonging to somebody else. Do not use the platform to collect other members' details in bulk.",
          )}
        </p>
      </S>

      <S n="04" title={tx("What we do not promise")}>
        <p>
          {tx(
            "No course, certificate or profile on this platform guarantees a job, an interview, or any income. Employers decide who they hire.",
          )}
        </p>
        <p>
          {tx(
            "Certificates are issued by the institute that ran the course and recorded by स्वYAM, on the strength of an assessment taken here. They are not issued by, endorsed by, or equivalent to any government qualification.",
          )}
        </p>
        <p>
          {tx(
            "Openings shown under “Also open elsewhere” come from an outside job board. We have not checked those employers and you apply on their site, under their terms.",
          )}
        </p>
        <p>
          {tx(
            "The assistant can be wrong. Check anything that matters — a fee, a deadline, an eligibility rule — against the official source we link to.",
          )}
        </p>
        <p>
          {tx(
            "Government scheme information is our plain-language summary. The ministry decides who qualifies, not this site, which is why the checker never says more than “likely”.",
          )}
        </p>
      </S>

      <S n="05" title={tx("Payments")}>
        <p>
          {tx(
            "स्वYAM takes no payments. Any fee is paid directly to the institute, on its terms. Nothing here charges a card, and any price shown is what a course costs, not a transaction you have made.",
          )}
        </p>
      </S>

      <S n="06" title={tx("Ending it")}>
        <p>
          {tx(
            "You may close your account at any time by writing to us from the Contact page. We may suspend one that is being used to harm other members, to impersonate somebody, or to post listings that are not real.",
          )}
        </p>
      </S>

      <S n="07" title={tx("Liability and law")}>
        <p>
          {tx(
            "The platform is provided “as is”. To the extent the law allows, we are not liable for indirect or consequential loss, including a job you did not get. Nothing here limits liability that cannot lawfully be limited.",
          )}
        </p>
        <p>{tx("These terms are governed by the laws of India.")}</p>
      </S>
    </Doc>
  );
}
