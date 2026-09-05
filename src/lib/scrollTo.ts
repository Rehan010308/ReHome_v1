/**
 * Smooth-scroll to an in-page section by id.
 * Used instead of `#anchor` links because the app runs on HashRouter,
 * where a plain href="#..." would be interpreted as a route change.
 */
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}