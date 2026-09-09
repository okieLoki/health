/**
 * Spot illustrations. Flat, geometric, built from the app's own arc motif so
 * empty states feel designed rather than decorated with stock art.
 */

export function ArtPlate({ className = "h-32 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="">
      <ellipse cx="80" cy="104" rx="50" ry="6" fill="var(--ink)" opacity="0.06" />
      <circle cx="80" cy="58" r="42" fill="var(--surface-2)" stroke="var(--hairline-strong)" strokeWidth="2" />
      <circle cx="80" cy="58" r="30" fill="var(--surface)" stroke="var(--hairline)" strokeWidth="1.5" />
      <path d="M98 43a23 23 0 1 0 0 30" fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="98" cy="73" r="5.5" fill="var(--brand)" />
      <circle cx="34" cy="30" r="4" fill="var(--series-2)" opacity="0.9" />
      <circle cx="130" cy="28" r="3" fill="var(--series-1)" opacity="0.85" />
      <circle cx="132" cy="88" r="3.5" fill="var(--series-3)" opacity="0.85" />
    </svg>
  );
}

export function ArtScale({ className = "h-32 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="">
      <ellipse cx="80" cy="104" rx="46" ry="6" fill="var(--ink)" opacity="0.06" />
      <rect x="36" y="58" width="88" height="42" rx="14" fill="var(--surface-2)" stroke="var(--hairline-strong)" strokeWidth="2" />
      <rect x="52" y="70" width="56" height="18" rx="9" fill="var(--surface)" stroke="var(--hairline)" strokeWidth="1.5" />
      <path d="M62 80h36" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 44c10-16 30-24 46-18" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <path d="M96 22l14 6-6 13" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtBarbell({ className = "h-32 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="">
      <ellipse cx="80" cy="102" rx="46" ry="6" fill="var(--ink)" opacity="0.06" />
      <rect x="46" y="54" width="68" height="9" rx="4.5" fill="var(--hairline-strong)" />
      <rect x="28" y="40" width="15" height="37" rx="7" fill="var(--brand)" />
      <rect x="117" y="40" width="15" height="37" rx="7" fill="var(--brand)" />
      <rect x="16" y="48" width="10" height="21" rx="5" fill="var(--brand)" opacity="0.45" />
      <rect x="134" y="48" width="10" height="21" rx="5" fill="var(--brand)" opacity="0.45" />
      <circle cx="80" cy="24" r="4" fill="var(--series-2)" opacity="0.8" />
    </svg>
  );
}

export function ArtChat({ className = "h-32 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label="">
      <ellipse cx="80" cy="104" rx="46" ry="6" fill="var(--ink)" opacity="0.06" />
      <rect x="22" y="26" width="90" height="46" rx="18" fill="var(--surface-2)" stroke="var(--hairline-strong)" strokeWidth="2" />
      <path d="M42 72v14l17-14z" fill="var(--surface-2)" stroke="var(--hairline-strong)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 43h42M40 56h26" stroke="var(--ink-3)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <circle cx="120" cy="66" r="24" fill="var(--brand)" />
      <path d="M131 55a15 15 0 1 0 0 22" fill="none" stroke="var(--brand-ink)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="131" cy="77" r="3.5" fill="var(--brand-ink)" />
    </svg>
  );
}
