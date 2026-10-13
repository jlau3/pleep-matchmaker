/** Theme picked in Settings, per device. Absent or "system" follows the device. */
export const THEME_COOKIE = "pm_theme";

export type Theme = "system" | "light" | "dark";

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
