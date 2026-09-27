// XP estimate for a segment from airport coordinates and the configured XP rules.
// Results are estimates only: they pre-fill expected XP, never actual XP.
import type { Airport, Cabin, IsoDate, XpRule } from './types';

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: Pick<Airport, 'latitude' | 'longitude'>, b: Pick<Airport, 'latitude' | 'longitude'>): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isDomestic(a: Pick<Airport, 'country_code'>, b: Pick<Airport, 'country_code'>): boolean {
  return a.country_code != null && a.country_code === b.country_code;
}

export function rulesActiveOn(rules: XpRule[], date: IsoDate): XpRule[] {
  return rules.filter((r) => r.effective_from <= date && (r.effective_to == null || r.effective_to >= date));
}

function inBand(rule: XpRule, miles: number): boolean {
  return (rule.min_distance_miles == null || miles >= rule.min_distance_miles) &&
    (rule.max_distance_miles == null || miles < rule.max_distance_miles);
}

/**
 * Picks the rule for a flight: a domestic rule when both airports are in the same
 * country (if one exists), otherwise the distance band. When several rule sets are
 * active on the date, the most recently effective one wins.
 */
export function findRule(rules: XpRule[], params: { date: IsoDate; cabin: Cabin; miles: number; domestic: boolean }): XpRule | null {
  const candidates = rulesActiveOn(rules, params.date)
    .filter((r) => r.cabin === params.cabin)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  if (params.domestic) {
    const domestic = candidates.find((r) => r.is_domestic);
    if (domestic) return domestic;
  }
  return candidates.find((r) => !r.is_domestic && inBand(r, params.miles)) ?? null;
}

export interface XpEstimate {
  origin: string;
  destination: string;
  cabin: Cabin;
  distanceMiles: number | null;
  domestic: boolean;
  routeCategory: string | null;
  xp: number | null;
  problem: 'unknown-origin' | 'unknown-destination' | 'no-rule' | null;
}

export function estimateSegmentXp(
  segment: { origin: string; destination: string; cabin: Cabin; date: IsoDate },
  airports: Map<string, Airport>,
  rules: XpRule[],
): XpEstimate {
  const base = { origin: segment.origin, destination: segment.destination, cabin: segment.cabin };
  const from = airports.get(segment.origin);
  const to = airports.get(segment.destination);
  if (!from) return { ...base, distanceMiles: null, domestic: false, routeCategory: null, xp: null, problem: 'unknown-origin' };
  if (!to) return { ...base, distanceMiles: null, domestic: false, routeCategory: null, xp: null, problem: 'unknown-destination' };

  const miles = haversineMiles(from, to);
  const domestic = isDomestic(from, to);
  const rule = findRule(rules, { date: segment.date, cabin: segment.cabin, miles, domestic });
  return {
    ...base,
    distanceMiles: Math.round(miles),
    domestic,
    routeCategory: rule?.route_category ?? null,
    xp: rule?.xp ?? null,
    problem: rule ? null : 'no-rule',
  };
}
