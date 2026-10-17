/** One roll per appearance; the shiny version is a 1-in-500 cosmetic surprise. */
export function snorlaxVariant(random = Math.random): "normal" | "shiny" {
  return random() < 1 / 500 ? "shiny" : "normal";
}
