import type { PlaceKind } from '@/lib/directions';

/**
 * Small pictograms for places, drawn in a 12 × 12 box as white strokes (and the odd fill) on
 * the place's colour: the same marks on the map and next to the goal's name.
 */
export const GLYPH: Record<PlaceKind, { stroke?: string; fill?: string }> = {
  hotel: { stroke: 'M2 9.6V3.4 M2 7.2h8v2.4 M10 7.2V5.9a1.2 1.2 0 0 0-1.2-1.2H5.6v2.5', fill: 'M3.7 4.8a1 1 0 1 1 0 2 1 1 0 0 1 0-2z' },
  bank: { stroke: 'M1.8 3.6h8.4v5H1.8z M4.4 6.1a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0 M1.8 10h8.4' },
  museum: { stroke: 'M3.2 5.4v3.6 M6 5.4v3.6 M8.8 5.4v3.6 M2 10.2h8', fill: 'M1.6 4.6 6 1.8l4.4 2.8z' },
  cafe: { stroke: 'M2.5 4.4h5.6v2.5a2.8 2.8 0 0 1-5.6 0z M8.1 5h.7a1.25 1.25 0 0 1 0 2.5h-.9 M2 10.4h7.2' },
  pharmacy: { fill: 'M4.7 1.8h2.6v2.9h2.9v2.6H7.3v2.9H4.7V7.3H1.8V4.7h2.9z' },
  post: { stroke: 'M1.8 3.4h8.4v5.6H1.8z M1.9 3.6 6 6.6l4.1-3' },
  supermarket: { stroke: 'M1.4 2.4h1.7l1.3 5.4h5.2l1-3.6H3.6', fill: 'M4.8 9.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z M8.7 9.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z' },
  station: { stroke: 'M3.6 1.8h4.8a1.2 1.2 0 0 1 1.2 1.2v4.6a1.2 1.2 0 0 1-1.2 1.2H3.6a1.2 1.2 0 0 1-1.2-1.2V3a1.2 1.2 0 0 1 1.2-1.2z M2.4 5.3h7.2 M4.2 10.4l1-1.6 M7.8 10.4l-1-1.6' },
  theatre: { stroke: 'M2 2.6h8 M2.6 2.6c0 3.9 1.4 6.3 3.4 7.4 2-1.1 3.4-3.5 3.4-7.4 M4.4 5.2h.01 M7.6 5.2h.01 M4.6 7.3c.8.6 2 .6 2.8 0' },
  restaurant: { stroke: 'M3.4 1.8v3.3a1.2 1.2 0 0 0 2.4 0V1.8 M4.6 1.8v8.6 M8.6 10.4V1.8c-1.3.7-1.7 2.3-1.7 4.2h1.7' },
  gallery: { stroke: 'M1.8 2.4h8.4v7.2H1.8z M2.4 8.8l2.6-3 2 2.1 1.2-1.2 1.6 2.1' },
  market: { stroke: 'M2 4.6l.9-2.2h6.2l.9 2.2 M2 4.6c0 1.6 2.7 1.6 2.7 0 0 1.6 2.6 1.6 2.6 0 0 1.6 2.7 1.6 2.7 0 M2.8 6.2v4h6.4v-4' },
  park: { stroke: 'M6 10.4V7.2', fill: 'M6 1.6a2.9 2.9 0 0 1 2.7 4 2.2 2.2 0 0 1-1.2 3.1h-3a2.2 2.2 0 0 1-1.2-3.1 2.9 2.9 0 0 1 2.7-4z' },
  square: { stroke: 'M2 9.8h8 M3 9.8c.3-1.5 1.5-2.4 3-2.4s2.7.9 3 2.4 M6 7.4V3.8 M4.1 4.6C4.4 3.1 5.1 2.4 6 2.4s1.6.7 1.9 2.2' },
};
