"use client";

/** Yellow Top 3 star. Filled when starred, outlined otherwise. */
export function StarButton({
  starred,
  name,
  onClick,
  className = "",
}: {
  starred: boolean;
  name: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${name} from Top 3` : `Add ${name} to Top 3`}
      title={starred ? "Remove from Top 3" : "Add to Top 3"}
      className={`rounded-full p-1.5 hover:bg-sun/20 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
        <path
          d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"
          strokeLinejoin="round"
          strokeWidth="1.8"
          className={starred ? "fill-sun stroke-sun-deep" : "fill-transparent stroke-slate-400"}
        />
      </svg>
    </button>
  );
}
