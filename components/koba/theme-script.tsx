// Runs before hydration (inline, blocking) so the correct theme is set on
// <html> before first paint — no flash of the wrong theme. Reads a saved
// preference from localStorage, falls back to the OS preference via
// prefers-color-scheme, and mirrors the choice into a cookie so the
// server can render the right `data-theme` attribute on the next request
// too (avoids a hydration mismatch on reload).
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("koba-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.cookie = "koba-theme=" + theme + ";path=/;max-age=31536000;samesite=lax";
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
