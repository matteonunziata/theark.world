/** The ARK leaf, from the prototype's dashboard. */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      <path d="M100 190C100 120 100 70 100 20" />
      <path d="M100 150c-30-8-52-30-58-62 30 4 52 26 58 62zM100 150c30-8 52-30 58-62-30 4-52 26-58 62zM100 105c-24-6-40-24-44-50 24 3 40 21 44 50zM100 105c24-6 40-24 44-50-24 3-40 21-44 50zM100 62c-16-4-27-16-29-34 16 2 27 14 29 34zM100 62c16-4 27-16 29-34-16 2-27 14-29 34z" />
    </svg>
  );
}
