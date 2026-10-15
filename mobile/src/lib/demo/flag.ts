/** True in the browser demo build (EXPO_PUBLIC_DEMO=1): the app talks to an in-browser API instead of a server. */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/** The traveller the demo signs in as by itself. */
export const DEMO_EMAIL = 'demo@gate21.app';

/** Which build this is (the git commit, set by the Demo workflow). */
export const DEMO_BUILD = process.env.EXPO_PUBLIC_DEMO_BUILD ?? 'local';

/**
 * GitHub Pages lets browsers cache index.html for 10 minutes, so right after a new demo is
 * published a phone may still open the old one. Ask for the published build number, bypassing
 * the cache, and reload once with a fresh URL when it is newer.
 */
export function reloadIfOutdated(): void {
  if (!DEMO || DEMO_BUILD === 'local' || typeof window === 'undefined' || typeof fetch === 'undefined') {
    return;
  }
  const base = process.env.EXPO_PUBLIC_BASE_URL ?? '';
  fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((v: { build?: string } | null) => {
      if (!v?.build || v.build === DEMO_BUILD) {
        return;
      }
      const url = new URL(window.location.href);
      if (url.searchParams.get('v') !== v.build) {
        url.searchParams.set('v', v.build);
        window.location.replace(url.toString());
      }
    })
    .catch(() => undefined);
}
