export const MAX_PHRASE = 120;

/**
 * The typed phrase, made safe to send anywhere: text only, one line, at most 120 characters, with anything that
 * looks like personal data (addresses, links, phone or ID-length numbers) removed. Used before the keyword
 * matcher and before the optional server call, so the server never sees more than a short destination phrase.
 */
export function scrubPhrase(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return (
    raw
      .slice(0, 400)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, " ")
      .replace(/\+?\d[\d\s().-]{5,}\d/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_PHRASE)
      .trim()
  );
}
