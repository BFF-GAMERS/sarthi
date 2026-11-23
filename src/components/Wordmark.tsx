export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span aria-label="Swyam" className={"inline-block whitespace-nowrap font-display font-semibold leading-none " + className}>
      <span className="font-devanagari" style={{ color: "var(--color-saffron-500)" }}>
        स्व
      </span>
      YAM
    </span>
  );
}
