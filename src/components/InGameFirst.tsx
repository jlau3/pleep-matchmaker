/**
 * The friends list here should copy your Pokémon Sleep friend list: adding
 * someone only here changes nothing in the game, it just bends your Tier List
 * toward a person you don't send candy to.
 */
export function InGameFirst({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-2xl bg-sky/60 px-3 py-2 text-sm dark:bg-night-deep ${className}`}>
      <b>Friends here should match your Pokémon Sleep friends.</b> Add someone in the game first, then add them here,
      so your Tier List follows the people you actually send candy to.
    </p>
  );
}
