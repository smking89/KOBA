/** Keeps the browser-tab favicon in sync with the manual theme toggle —
 * the metadata-driven `<link media="...">` variants only track the OS
 * preference. Mirrors the same DOM update theme-script.tsx's inline
 * anti-FOUC script performs (that one has to stay a literal string, so
 * this logic is intentionally duplicated there, not imported). */
export function applyFaviconForTheme(theme: "dark" | "light"): void {
  let link = document.querySelector<HTMLLinkElement>("link[data-koba-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-koba-favicon", "1");
    document.head.appendChild(link);
  }
  link.href = theme === "dark" ? "/favicon-dark.png" : "/favicon-light.png";
}
