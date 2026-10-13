"use client";

/** Last resort when the layout itself fails: a bare page with a reload button. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem", background: "#e4f2ff", color: "#2d3354" }}>
        <h1>Pleep Matchmaker hit a snag</h1>
        <p>Please try again in a moment.</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1.5rem", borderRadius: 999, border: 0, background: "#ffd24d", fontWeight: 800 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
