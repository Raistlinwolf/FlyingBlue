import { airports } from './airports.js';

function findAirport(code) {
  return airports.find(a => a.iata === code || a.icao === code);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半徑 (km)
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 根據 Flying Blue XP 規則定義區間與艙等加權
function computeXP(distance, cabinClass, sameCountry = false) {
  let baseXP = 0;

  if (sameCountry) baseXP = 2;
  else if (distance < 2000 * 1.60934) baseXP = 5;       // convert miles to km
  else if (distance < 3500 * 1.60934) baseXP = 8;
  else if (distance < 5000 * 1.60934) baseXP = 10;
  else baseXP = 12;

  const multiplier = {
    economy: 1,
    premium: 2,
    business: 3,
    first: 5,
  }[cabinClass] || 1;

  return baseXP * multiplier;
}

export function calculateFlightXP(fromCode, toCode, cabinClass, roundtrip = false, doublexp = false) {
  const origin = findAirport(fromCode);
  const dest = findAirport(toCode);
  if (!origin || !dest) return null;

  const distance = haversine(origin.lat, origin.lon, dest.lat, dest.lon);
  const sameCountry = origin.country === dest.country;

  const xp = computeXP(distance, cabinClass, sameCountry);
  const totalXP = (roundtrip ? 2 : 1) * (doublexp ? 2 : 1) * xp;

  return {
    route: `${origin.iata} → ${dest.iata}`,
    xp: totalXP,
    distance: Math.round(distance)
  };
}
