/**
 * Days from adding someone in Pokémon Sleep to the top friendship (closeness)
 * level, 5. Player-reported, not from an official source; change it here if
 * the game says otherwise.
 */
export const DAYS_TO_FRIENDSHIP_LEVEL_5 = 100;

/** The local calendar date someone added on `from` reaches friendship level 5. */
export function friendshipLevel5Date(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + DAYS_TO_FRIENDSHIP_LEVEL_5);
  return d;
}
