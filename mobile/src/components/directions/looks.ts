import type { PlaceKind, TownSpec } from '@/lib/directions';

/**
 * Each city has its own character, kept within one quiet palette: London in brick and slate
 * with plane trees and red buses, New York in concrete and brownstone with tall blocks, water
 * towers and yellow cabs, Sydney in terracotta and sandstone with palms, jacarandas and ferries.
 */
export type Look = {
  name: string;
  land: string;
  pavement: string;
  kerb: string;
  road: string;
  roadMajor: string;
  marking: string;
  courtyard: string;
  garden: number; // share of courtyards that are gardens
  roofs: string[];
  pitched: number; // share of pitched roofs
  height: [number, number];
  park: string;
  parkEdge: string;
  trees: string[];
  treeDark: string;
  palms: boolean;
  blossom?: string;
  water: string;
  waterEdge: string;
  quay: string;
  bridges: boolean;
  driveLeft: boolean;
  cars: string[];
  bus: string;
  taxi: string;
  boats: 'river' | 'piers' | 'harbour';
};

export const LOOKS: Record<NonNullable<TownSpec['look']>, Look> = {
  london: {
    name: 'London',
    land: '#EFEBE3',
    pavement: '#F3F0E9',
    kerb: '#D6D0C4',
    road: '#D0D1CE',
    roadMajor: '#C9CAC7',
    marking: '#F7F6F2',
    courtyard: '#E3DFD3',
    garden: 0.7,
    roofs: ['#C29A86', '#B98E7B', '#A9AEB2', '#B6BBBE', '#CDBFA9', '#C7A592'],
    pitched: 0.75,
    height: [3, 6],
    park: '#CBDDB8',
    parkEdge: '#B9CFA4',
    trees: ['#9DBB86', '#8DB07A', '#A9C48F'],
    treeDark: '#6F9562',
    palms: false,
    water: '#B9D2DD',
    waterEdge: '#A1BDCA',
    quay: '#D9D2C3',
    bridges: true,
    driveLeft: true,
    cars: ['#5F6B75', '#8C8F91', '#E9E6E0', '#6B5B53', '#3E4D5C'],
    bus: '#B9483D',
    taxi: '#2F3438',
    boats: 'river',
  },
  newyork: {
    name: 'New York',
    land: '#ECEAE5',
    pavement: '#F1EFEA',
    kerb: '#D3D0C9',
    road: '#C9CACA',
    roadMajor: '#C2C3C4',
    marking: '#F5F4EF',
    courtyard: '#DDDAD2',
    garden: 0.2,
    roofs: ['#BDB7AD', '#C9C4BB', '#A99C8F', '#B3ABA3', '#9EA3A7', '#D1CCC3'],
    pitched: 0.05,
    height: [6, 15],
    park: '#C9DCB5',
    parkEdge: '#B6CDA0',
    trees: ['#98B983', '#88AD78', '#A4C28C'],
    treeDark: '#6C915F',
    palms: false,
    water: '#B5CED9',
    waterEdge: '#9DB8C6',
    quay: '#CFCAC0',
    bridges: false,
    driveLeft: false,
    cars: ['#59636C', '#8E9194', '#E8E6E1', '#4F5F70', '#7A3F3A'],
    bus: '#3F6A9A',
    taxi: '#E2B23F',
    boats: 'piers',
  },
  sydney: {
    name: 'Sydney',
    land: '#F1ECE2',
    pavement: '#F5F1E8',
    kerb: '#DAD2C3',
    road: '#D2D0CB',
    roadMajor: '#CBC9C4',
    marking: '#F8F6F1',
    courtyard: '#E2DCCD',
    garden: 0.6,
    roofs: ['#CC9B7E', '#C38E73', '#DCCCAB', '#E3DED3', '#D5A88B', '#BFC2BE'],
    pitched: 0.6,
    height: [3, 8],
    park: '#CEDDB4',
    parkEdge: '#BCCF9F',
    trees: ['#A1BA84', '#90AE78', '#B0C48E'],
    treeDark: '#73915E',
    palms: true,
    blossom: '#B8A7C6',
    water: '#B3D1DE',
    waterEdge: '#98BDCD',
    quay: '#DCD2BE',
    bridges: false,
    driveLeft: true,
    cars: ['#E8E6E0', '#6D7780', '#8F9396', '#3F5468', '#A35B45'],
    bus: '#2F6E8E',
    taxi: '#E8E6E0',
    boats: 'harbour',
  },
};

export const lookOf = (town: TownSpec): Look => LOOKS[town.look ?? 'london'];

/** Marker colours: muted, one family, telling place types apart without shouting. */
export const POI: Record<PlaceKind, string> = {
  hotel: '#A85C45',
  bank: '#4E5D6B',
  museum: '#8A6E45',
  cafe: '#946640',
  pharmacy: '#3E8A5C',
  post: '#B0473B',
  supermarket: '#477591',
  station: '#34506A',
  theatre: '#76566A',
  restaurant: '#9E663D',
  gallery: '#6F6A5E',
  market: '#8A7A42',
  park: '#5A8650',
  square: '#857860',
};
