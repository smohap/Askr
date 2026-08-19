/**
 * Service locations, with coordinates.
 *
 * Matching is by distance, so a request needs real coordinates. Phase 1 has no
 * geocoding dependency, so the buyer picks from this list — enough to cover the
 * main centres and the Auckland suburbs the seed providers work in. Swapping
 * this for a geocoder later only changes where lat/lng come from.
 */

export type NzLocation = {
  label: string;
  lat: number;
  lng: number;
};

export const NZ_LOCATIONS: readonly NzLocation[] = [
  // Auckland
  { label: "Auckland Central", lat: -36.8485, lng: 174.7633 },
  { label: "Mount Eden, Auckland", lat: -36.8779, lng: 174.758 },
  { label: "Kingsland, Auckland", lat: -36.874, lng: 174.746 },
  { label: "Ponsonby, Auckland", lat: -36.8566, lng: 174.7454 },
  { label: "Grey Lynn, Auckland", lat: -36.86, lng: 174.74 },
  { label: "Epsom, Auckland", lat: -36.889, lng: 174.776 },
  { label: "Newmarket, Auckland", lat: -36.8695, lng: 174.7767 },
  { label: "Takapuna, Auckland", lat: -36.7869, lng: 174.7756 },
  { label: "Manukau, Auckland", lat: -36.9939, lng: 174.8797 },
  { label: "Henderson, Auckland", lat: -36.8801, lng: 174.6303 },
  // Main centres
  { label: "Hamilton", lat: -37.787, lng: 175.2793 },
  { label: "Tauranga", lat: -37.6878, lng: 176.1651 },
  { label: "Rotorua", lat: -38.1368, lng: 176.2497 },
  { label: "Napier", lat: -39.4928, lng: 176.912 },
  { label: "Palmerston North", lat: -40.3523, lng: 175.6082 },
  { label: "Wellington", lat: -41.2866, lng: 174.7756 },
  { label: "Lower Hutt", lat: -41.2135, lng: 174.9078 },
  { label: "Nelson", lat: -41.2706, lng: 173.284 },
  { label: "Christchurch", lat: -43.5321, lng: 172.6362 },
  { label: "Dunedin", lat: -45.8788, lng: 170.5028 },
  { label: "Queenstown", lat: -45.0312, lng: 168.6626 },
  { label: "Invercargill", lat: -46.4132, lng: 168.3538 },
];

export function findLocation(label: string): NzLocation | undefined {
  return NZ_LOCATIONS.find((l) => l.label === label);
}
