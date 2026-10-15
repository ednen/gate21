/** True in the browser demo build (EXPO_PUBLIC_DEMO=1): the app talks to an in-browser API instead of a server. */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/** The traveller the demo signs in as by itself. */
export const DEMO_EMAIL = 'demo@gate21.app';
