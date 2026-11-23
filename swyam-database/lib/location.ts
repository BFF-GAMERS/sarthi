/**
 * Location helpers for proximity-ranked listings.
 *
 * Coordinates are held locally rather than fetched, so ranking works offline
 * and needs no geocoding key. Browser geolocation is offered as an optional
 * convenience; the user's manual choice always wins.
 */

export interface CityPoint {
  city: string;
  state: string;
  lat: number;
  lon: number;
  /**
   * 1 for the eight X-class metros, 2 for the Y-class cities, in the
   * classification the central government uses for HRA. It is the closest
   * thing to an official "tier" list, so it is the one used here.
   */
  tier: 1 | 2;
}

/**
 * Tier 1 and tier 2 India.
 *
 * This was twenty-four cities: the ones that happened to appear in the seeded
 * listings, plus a handful of metros. Everywhere else in the country resolved
 * to nothing, so somebody in Salem or Siliguri could not pick their own city,
 * every distance came back null, and "events near me" quietly meant "events
 * near the eight cities we thought of".
 *
 * The list is now the full X and Y classification. Coordinates are held here
 * rather than geocoded so ranking still works with no network and no key.
 */
export const CITIES: CityPoint[] = [
  /* ── Tier 1 (X class) ─────────────────────────────────────────── */
  { city: "New Delhi", state: "Delhi", lat: 28.6139, lon: 77.209, tier: 1 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777, tier: 1 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lon: 77.5946, tier: 1 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.4867, tier: 1 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, tier: 1 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639, tier: 1 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lon: 72.5714, tier: 1 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lon: 73.8567, tier: 1 },

  /* ── Tier 2 (Y class) ─────────────────────────────────────────── */
  { city: "Agra", state: "Uttar Pradesh", lat: 27.1767, lon: 78.0081, tier: 2 },
  { city: "Ajmer", state: "Rajasthan", lat: 26.4499, lon: 74.6399, tier: 2 },
  { city: "Aligarh", state: "Uttar Pradesh", lat: 27.8974, lon: 78.088, tier: 2 },
  { city: "Amravati", state: "Maharashtra", lat: 20.9374, lon: 77.7796, tier: 2 },
  { city: "Amritsar", state: "Punjab", lat: 31.634, lon: 74.8723, tier: 2 },
  { city: "Asansol", state: "West Bengal", lat: 23.6739, lon: 86.9524, tier: 2 },
  { city: "Aurangabad", state: "Maharashtra", lat: 19.8762, lon: 75.3433, tier: 2 },
  { city: "Bareilly", state: "Uttar Pradesh", lat: 28.367, lon: 79.4304, tier: 2 },
  { city: "Belagavi", state: "Karnataka", lat: 15.8497, lon: 74.4977, tier: 2 },
  { city: "Bhavnagar", state: "Gujarat", lat: 21.7645, lon: 72.1519, tier: 2 },
  { city: "Bhilai", state: "Chhattisgarh", lat: 21.1938, lon: 81.3509, tier: 2 },
  { city: "Bhiwandi", state: "Maharashtra", lat: 19.2813, lon: 73.0483, tier: 2 },
  { city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lon: 77.4126, tier: 2 },
  { city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lon: 85.8245, tier: 2 },
  { city: "Bikaner", state: "Rajasthan", lat: 28.0229, lon: 73.3119, tier: 2 },
  { city: "Bilaspur", state: "Chhattisgarh", lat: 22.0797, lon: 82.1409, tier: 2 },
  { city: "Bokaro Steel City", state: "Jharkhand", lat: 23.6693, lon: 86.1511, tier: 2 },
  { city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lon: 76.7794, tier: 2 },
  { city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lon: 76.9558, tier: 2 },
  { city: "Cuttack", state: "Odisha", lat: 20.4625, lon: 85.8828, tier: 2 },
  { city: "Dehradun", state: "Uttarakhand", lat: 30.3165, lon: 78.0322, tier: 2 },
  { city: "Dhanbad", state: "Jharkhand", lat: 23.7957, lon: 86.4304, tier: 2 },
  { city: "Durgapur", state: "West Bengal", lat: 23.5204, lon: 87.3119, tier: 2 },
  { city: "Erode", state: "Tamil Nadu", lat: 11.341, lon: 77.7172, tier: 2 },
  { city: "Faridabad", state: "Haryana", lat: 28.4089, lon: 77.3178, tier: 2 },
  { city: "Firozabad", state: "Uttar Pradesh", lat: 27.1591, lon: 78.3958, tier: 2 },
  { city: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lon: 77.4538, tier: 2 },
  { city: "Gorakhpur", state: "Uttar Pradesh", lat: 26.7606, lon: 83.3732, tier: 2 },
  { city: "Guntur", state: "Andhra Pradesh", lat: 16.3067, lon: 80.4365, tier: 2 },
  { city: "Gurugram", state: "Haryana", lat: 28.4595, lon: 77.0266, tier: 2 },
  { city: "Guwahati", state: "Assam", lat: 26.1445, lon: 91.7362, tier: 2 },
  { city: "Gwalior", state: "Madhya Pradesh", lat: 26.2183, lon: 78.1828, tier: 2 },
  { city: "Hamirpur", state: "Himachal Pradesh", lat: 31.6839, lon: 76.5225, tier: 2 },
  { city: "Hubballi", state: "Karnataka", lat: 15.3647, lon: 75.124, tier: 2 },
  { city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lon: 75.8577, tier: 2 },
  { city: "Jabalpur", state: "Madhya Pradesh", lat: 23.1815, lon: 79.9864, tier: 2 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873, tier: 2 },
  { city: "Jalandhar", state: "Punjab", lat: 31.326, lon: 75.5762, tier: 2 },
  { city: "Jammu", state: "Jammu & Kashmir", lat: 32.7266, lon: 74.857, tier: 2 },
  { city: "Jamnagar", state: "Gujarat", lat: 22.4707, lon: 70.0577, tier: 2 },
  { city: "Jamshedpur", state: "Jharkhand", lat: 22.8046, lon: 86.2029, tier: 2 },
  { city: "Jhansi", state: "Uttar Pradesh", lat: 25.4484, lon: 78.5685, tier: 2 },
  { city: "Jodhpur", state: "Rajasthan", lat: 26.2389, lon: 73.0243, tier: 2 },
  { city: "Kakinada", state: "Andhra Pradesh", lat: 16.9891, lon: 82.2475, tier: 2 },
  { city: "Kannur", state: "Kerala", lat: 11.8745, lon: 75.3704, tier: 2 },
  { city: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lon: 80.3319, tier: 2 },
  { city: "Karnal", state: "Haryana", lat: 29.6857, lon: 76.9905, tier: 2 },
  { city: "Kochi", state: "Kerala", lat: 9.9312, lon: 76.2673, tier: 2 },
  { city: "Kolhapur", state: "Maharashtra", lat: 16.705, lon: 74.2433, tier: 2 },
  { city: "Kollam", state: "Kerala", lat: 8.8932, lon: 76.6141, tier: 2 },
  { city: "Kota", state: "Rajasthan", lat: 25.2138, lon: 75.8648, tier: 2 },
  { city: "Kozhikode", state: "Kerala", lat: 11.2588, lon: 75.7804, tier: 2 },
  { city: "Kurnool", state: "Andhra Pradesh", lat: 15.8281, lon: 78.0373, tier: 2 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462, tier: 2 },
  { city: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.8573, tier: 2 },
  { city: "Madurai", state: "Tamil Nadu", lat: 9.9252, lon: 78.1198, tier: 2 },
  { city: "Malappuram", state: "Kerala", lat: 11.041, lon: 76.0788, tier: 2 },
  { city: "Mangaluru", state: "Karnataka", lat: 12.9141, lon: 74.856, tier: 2 },
  { city: "Mathura", state: "Uttar Pradesh", lat: 27.4924, lon: 77.6737, tier: 2 },
  { city: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lon: 77.7064, tier: 2 },
  { city: "Moradabad", state: "Uttar Pradesh", lat: 28.8386, lon: 78.7733, tier: 2 },
  { city: "Mysuru", state: "Karnataka", lat: 12.2958, lon: 76.6394, tier: 2 },
  { city: "Nagpur", state: "Maharashtra", lat: 21.1458, lon: 79.0882, tier: 2 },
  { city: "Nanded", state: "Maharashtra", lat: 19.1383, lon: 77.321, tier: 2 },
  { city: "Nashik", state: "Maharashtra", lat: 19.9975, lon: 73.7898, tier: 2 },
  { city: "Nellore", state: "Andhra Pradesh", lat: 14.4426, lon: 79.9865, tier: 2 },
  { city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lon: 77.391, tier: 2 },
  { city: "Patna", state: "Bihar", lat: 25.5941, lon: 85.1376, tier: 2 },
  { city: "Prayagraj", state: "Uttar Pradesh", lat: 25.4358, lon: 81.8463, tier: 2 },
  { city: "Puducherry", state: "Puducherry", lat: 11.9416, lon: 79.8083, tier: 2 },
  { city: "Purulia", state: "West Bengal", lat: 23.3322, lon: 86.3616, tier: 2 },
  { city: "Raipur", state: "Chhattisgarh", lat: 21.2514, lon: 81.6296, tier: 2 },
  { city: "Rajahmundry", state: "Andhra Pradesh", lat: 17.0005, lon: 81.804, tier: 2 },
  { city: "Rajkot", state: "Gujarat", lat: 22.3039, lon: 70.8022, tier: 2 },
  { city: "Ranchi", state: "Jharkhand", lat: 23.3441, lon: 85.3096, tier: 2 },
  { city: "Ratlam", state: "Madhya Pradesh", lat: 23.3315, lon: 75.0367, tier: 2 },
  { city: "Rourkela", state: "Odisha", lat: 22.2604, lon: 84.8536, tier: 2 },
  { city: "Salem", state: "Tamil Nadu", lat: 11.6643, lon: 78.146, tier: 2 },
  { city: "Sangli", state: "Maharashtra", lat: 16.8524, lon: 74.5815, tier: 2 },
  { city: "Shimla", state: "Himachal Pradesh", lat: 31.1048, lon: 77.1734, tier: 2 },
  { city: "Siliguri", state: "West Bengal", lat: 26.7271, lon: 88.3953, tier: 2 },
  { city: "Solapur", state: "Maharashtra", lat: 17.6599, lon: 75.9064, tier: 2 },
  { city: "Srinagar", state: "Jammu & Kashmir", lat: 34.0837, lon: 74.7973, tier: 2 },
  { city: "Sultanpur", state: "Uttar Pradesh", lat: 26.2648, lon: 82.0727, tier: 2 },
  { city: "Surat", state: "Gujarat", lat: 21.1702, lon: 72.8311, tier: 2 },
  { city: "Thanjavur", state: "Tamil Nadu", lat: 10.787, lon: 79.1378, tier: 2 },
  { city: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lon: 76.9366, tier: 2 },
  { city: "Thrissur", state: "Kerala", lat: 10.5276, lon: 76.2144, tier: 2 },
  { city: "Tiruchirappalli", state: "Tamil Nadu", lat: 10.7905, lon: 78.7047, tier: 2 },
  { city: "Tirunelveli", state: "Tamil Nadu", lat: 8.7139, lon: 77.7567, tier: 2 },
  { city: "Tiruppur", state: "Tamil Nadu", lat: 11.1085, lon: 77.3411, tier: 2 },
  { city: "Ujjain", state: "Madhya Pradesh", lat: 23.1765, lon: 75.7885, tier: 2 },
  { city: "Vadodara", state: "Gujarat", lat: 22.3072, lon: 73.1812, tier: 2 },
  { city: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lon: 82.9739, tier: 2 },
  { city: "Vasai-Virar", state: "Maharashtra", lat: 19.3919, lon: 72.8397, tier: 2 },
  { city: "Vellore", state: "Tamil Nadu", lat: 12.9165, lon: 79.1325, tier: 2 },
  { city: "Vijayawada", state: "Andhra Pradesh", lat: 16.5062, lon: 80.648, tier: 2 },
  { city: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lon: 83.2185, tier: 2 },
  { city: "Warangal", state: "Telangana", lat: 17.9689, lon: 79.5941, tier: 2 },
];

export const CITY_NAMES = CITIES.map((c) => c.city).sort((a, b) => a.localeCompare(b));

/**
 * Resolve a free-text location like "Guindy Industrial Estate, Chennai".
 *
 * The fallback takes the LONGEST city name contained in the string, not the
 * first. With twenty-four cities "first match" was harmless; across a hundred
 * it is not — "New Delhi" contains "Delhi", and a first-match scan would
 * settle for whichever of the two the array happened to reach first. Longest
 * wins is the more specific answer and does not depend on array order.
 */
function findCity(name: string | null | undefined): CityPoint | null {
  if (!name) return null;
  const n = name.toLowerCase();

  const exact = CITIES.find((c) => c.city.toLowerCase() === n);
  if (exact) return exact;

  let best: CityPoint | null = null;
  for (const c of CITIES) {
    const key = c.city.toLowerCase();
    if (n.includes(key) && (!best || key.length > best.city.length)) best = c;
  }
  return best;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: CityPoint, b: CityPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/**
 * Distance from the user's city to a listing's free-text location.
 * Returns null when either end can't be resolved, or 0 for remote listings —
 * remote work is "everywhere", so it should never be pushed down the list.
 */
export function distanceFor(
  userCity: string | null,
  listingLocation: string,
  isRemote = false,
): number | null {
  if (isRemote) return 0;
  const from = findCity(userCity);
  const to = findCity(listingLocation);
  if (!from || !to) return null;
  return distanceKm(from, to);
}

export const DISTANCE_OPTIONS = [
  { id: "any", label: "Any distance", km: Infinity },
  { id: "25", label: "Within 25 km", km: 25 },
  { id: "100", label: "Within 100 km", km: 100 },
  { id: "300", label: "Within 300 km", km: 300 },
] as const;

export type DistanceOption = (typeof DISTANCE_OPTIONS)[number]["id"];

/** Sort helper: nearest first, unknown distances last. */
export function byDistance<T>(get: (item: T) => number | null) {
  return (a: T, b: T) => {
    const da = get(a);
    const db = get(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  };
}
