/** Corner filigree. Lives on frame edges only -- never behind text. */
export function Flourish({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 12c0-6 5-11 11-11" />
      <path d="M1 20c4.5 0 8-3.5 8-8s3.5-8 8-8" />
      <path d="M9 16c2.5-.6 4.4-2.5 5-5" />
      <circle cx="15.5" cy="7.5" r="1.4" />
      <path d="M20 1c-.4 3 1 5.4 3.4 6.4" />
      <path d="M1 25c3-.4 5.4 1 6.4 3.4" />
    </svg>
  )
}
