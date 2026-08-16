/**
 * Webpack still loads this file. Turbopack uses `instrumentation-client.ts`.
 * Keep a single client init by re-exporting that module.
 */
export { onRouterTransitionStart } from "./instrumentation-client";
