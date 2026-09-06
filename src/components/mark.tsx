/**
 * The mark is a "C" drawn as an open progress arc with a travelling dot
 * the letter and the core metaphor of the app are the same shape.
 */
export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Cut">
      <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="4.5" opacity="0.16" />
      <path
        d="M31.5 11.2A15 15 0 1 0 31.5 28.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="31.5" cy="28.8" r="3.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Mark className="size-7 text-[var(--brand)]" />
      <span className="text-[19px] font-extrabold tracking-[-0.045em]">Cut</span>
    </span>
  );
}
