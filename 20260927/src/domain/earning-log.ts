// Import from the "Earning Log" sheet of the original Excel tracker.
//
// Sheet layout (one row per flight or XP event):
//   年度 | 分類 | (預計)日期 | 起飛 | 降落 | 價格 | 飛行XP | SAF價格 | SAF XP | 信用卡年費 | 信用卡XP | 其他XP
// English headers (Year, Category, Date, From, To, Price, Flight XP, SAF price, …) work too.
//
// Rules:
// - A flight row with a price starts a new booking; price-0 rows join the open booking
//   whose last destination is their origin (so returns and connections stay on one ticket).
// - SAF columns on a flight row become a SAF XP transaction linked to that booking.
// - Non-flight rows ("AMEX 金卡", "Accor ALL", …) become Credit Card / Partner / Other XP.
// - Dates up to `today` are credited (actual XP); later dates are booked (expected XP).
// - Ids are derived from row content, so importing the same sheet twice updates rather
//   than duplicates.
import { addMonths, firstDayOfMonth, isIsoDate, lastDayOfMonth, monthKey } from './dates';
import { LEVEL_THRESHOLDS, levelTarget, lowerLevel, nextLevel } from './qualification';
import type { BookingCategory, Cabin, FlyingBlueStatus, IsoDate, XpSourceType } from './types';

export interface EarningLogRow {
  line: number;
  category: string;
  date: IsoDate;
  origin: string | null;
  destination: string | null;
  price: number;
  flightXp: number;
  safPrice: number;
  safXp: number;
  cardFee: number;
  cardXp: number;
  otherXp: number;
}

type Column = keyof Omit<EarningLogRow, 'line'>;

// Order matters: the more specific headers are matched first.
const HEADER_RULES: [Column, RegExp][] = [
  ['safPrice', /saf.*(價格|价格|price|cost)/],
  ['safXp', /saf.*xp/],
  ['cardFee', /(信用卡|card).*(年費|年费|fee)/],
  ['cardXp', /(信用卡|card).*xp/],
  ['otherXp', /(其他|other).*xp/],
  ['flightXp', /(飛行|飞行|flight).*xp/],
  ['price', /^(價格|价格|票價|票价|price|fare|cost)/],
  ['date', /日期|date/],
  ['origin', /起飛|起飞|^from$|origin|departure/],
  ['destination', /降落|^to$|destination|arrival/],
  ['category', /分類|分类|category|class/],
];

const normalizeHeader = (h: unknown) => String(h ?? '').toLowerCase().replace(/\s+/g, '');

/** Parses a number cell such as "350.83", "€ 1,300", "2,5" or 12. Empty/"-" → 0. */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value ?? '').replace(/[^\d.,-]/g, '');
  if (!text || text === '-') return 0;
  if (text.includes(',') && text.includes('.')) text = text.replace(/,/g, '');
  else if (/^-?\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.');
  else text = text.replace(/,/g, '');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

/** Accepts 2025-03-06, 2025/3/6, a Date, or an Excel serial day number. */
export function parseDate(value: unknown): IsoDate | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    return d.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = String(value ?? '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

export function cabinFromCategory(category: string): Cabin | null {
  const c = category.toLowerCase();
  if (/豪華經濟|豪华经济|premium/.test(c)) return 'Premium Economy';
  if (/經濟|经济|economy|^eco/.test(c)) return 'Economy';
  if (/商務|商务|business|^biz/.test(c)) return 'Business';
  if (/頭等|头等|first/.test(c)) return 'First';
  return null;
}

/** Finds the header row and reads every data row of an Earning Log sheet. */
export function parseEarningLog(rows: unknown[][]): { rows: EarningLogRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const headerIndex = rows.findIndex((r) => {
    const cells = r.map(normalizeHeader);
    return cells.some((c) => /起飛|起飞|^from$|origin/.test(c)) && cells.some((c) => /日期|date/.test(c));
  });
  if (headerIndex === -1) {
    return { rows: [], warnings: ['No header row found (expected columns such as 日期 / 起飛 / 降落 / 飛行XP).'] };
  }

  const columns = new Map<Column, number>();
  rows[headerIndex].forEach((cell, index) => {
    const h = normalizeHeader(cell);
    if (!h) return;
    const rule = HEADER_RULES.find(([col, re]) => !columns.has(col) && re.test(h));
    if (rule) columns.set(rule[0], index);
  });
  for (const required of ['date', 'origin', 'destination'] as Column[]) {
    if (!columns.has(required)) warnings.push(`Column for "${required}" not found.`);
  }

  const cell = (r: unknown[], col: Column) => (columns.has(col) ? r[columns.get(col)!] : undefined);
  const out: EarningLogRow[] = [];
  rows.slice(headerIndex + 1).forEach((r, i) => {
    const line = headerIndex + i + 2; // 1-based spreadsheet row
    if (!r.some((c) => String(c ?? '').trim() !== '')) return;
    const date = parseDate(cell(r, 'date'));
    if (!date) {
      warnings.push(`Row ${line}: no valid date, skipped.`);
      return;
    }
    const code = (v: unknown) => {
      const s = String(v ?? '').trim().toUpperCase();
      return /^[A-Z]{3}$/.test(s) ? s : null;
    };
    out.push({
      line,
      category: String(cell(r, 'category') ?? '').trim(),
      date,
      origin: code(cell(r, 'origin')),
      destination: code(cell(r, 'destination')),
      price: parseAmount(cell(r, 'price')),
      flightXp: parseAmount(cell(r, 'flightXp')),
      safPrice: parseAmount(cell(r, 'safPrice')),
      safXp: parseAmount(cell(r, 'safXp')),
      cardFee: parseAmount(cell(r, 'cardFee')),
      cardXp: parseAmount(cell(r, 'cardXp')),
      otherXp: parseAmount(cell(r, 'otherXp')),
    });
  });
  return { rows: out, warnings };
}

// --- Stable ids ------------------------------------------------------------------

/** Deterministic UUID-shaped id from a string (FNV-1a, 4 × 32 bit). Not cryptographic. */
export function stableUuid(key: string): string {
  const parts = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  });
  const hex = parts.join('');
  // Shape it as a version-4, RFC-4122-variant UUID so validators accept it.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// --- Import plan -----------------------------------------------------------------

export interface PlannedBooking {
  id: string;
  booking_name: string;
  purchase_date: IsoDate;
  category: BookingCategory;
  total_price: number;
  currency: string;
  status: 'Booked' | 'Flown';
  notes: string;
}

export interface PlannedSegment {
  id: string;
  booking_id: string;
  position: number;
  flight_date: IsoDate;
  origin_iata: string;
  destination_iata: string;
  marketing_airline: string;
  cabin: Cabin;
  expected_xp: number;
  actual_xp: number | null;
  segment_status: 'Booked' | 'Flown';
  notes: string | null;
}

export interface PlannedXpTransaction {
  id: string;
  booking_id: string | null;
  transaction_date: IsoDate;
  source_type: XpSourceType;
  description: string;
  cost: number;
  currency: string;
  expected_xp: number;
  actual_xp: number | null;
  status: 'Pending' | 'Credited';
  notes: string;
}

export interface ImportPlan {
  bookings: PlannedBooking[];
  segments: PlannedSegment[];
  xpTransactions: PlannedXpTransaction[];
  warnings: string[];
}

export interface ImportOptions {
  today: IsoDate;
  currency: string;
  category: BookingCategory;
  airline: string;
}

/** Airline stored on imported flights when none is given (the sheet has no airline column). */
export const UNKNOWN_AIRLINE = 'UNKNOWN';

const NOTE = 'Imported from Excel (Earning Log)';

function otherSource(category: string): XpSourceType {
  if (/accor|hotel|partner|夥伴|伙伴|合作/i.test(category)) return 'Partner';
  if (/promo|活動|活动|bonus/i.test(category)) return 'Promotion';
  if (/choice/i.test(category)) return 'Choice Benefit';
  return 'Other';
}

function bookingName(segments: PlannedSegment[]): string {
  const stops: string[] = [];
  for (const s of segments) {
    if (stops[stops.length - 1] !== s.origin_iata) stops.push(s.origin_iata);
    stops.push(s.destination_iata);
  }
  const shown = stops.length > 6 ? [...stops.slice(0, 5), '…'] : stops;
  return shown.join('–');
}

export function planImport(rows: EarningLogRow[], options: ImportOptions): ImportPlan {
  const warnings: string[] = [];
  const credited = (date: IsoDate) => date <= options.today;
  const seen = new Map<string, number>();
  const idFor = (key: string) => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return stableUuid(`${key}#${n}`);
  };

  interface OpenBooking {
    booking: PlannedBooking;
    segments: PlannedSegment[];
    start: string;
    last: string;
    closed: boolean;
  }
  const groups: OpenBooking[] = [];
  const xpTransactions: PlannedXpTransaction[] = [];
  const sorted = [...rows].sort((a, b) => (a.date === b.date ? a.line - b.line : a.date < b.date ? -1 : 1));

  const addXp = (row: EarningLogRow, source: XpSourceType, xp: number, cost: number, description: string, bookingId: string | null) => {
    if (xp === 0 && cost === 0) return;
    const isCredited = credited(row.date);
    xpTransactions.push({
      id: idFor(`xp|${source}|${row.date}|${description}`),
      booking_id: bookingId,
      transaction_date: row.date,
      source_type: source,
      description,
      cost,
      currency: options.currency,
      expected_xp: xp,
      actual_xp: isCredited ? xp : null,
      status: isCredited ? 'Credited' : 'Pending',
      notes: NOTE,
    });
  };

  for (const row of sorted) {
    const isFlight = row.origin != null && row.destination != null && row.origin !== row.destination;
    if (!isFlight) {
      if (row.origin || row.destination) warnings.push(`Row ${row.line}: incomplete route, imported as XP only.`);
      const label = row.category || 'Other';
      addXp(row, 'Credit Card', row.cardXp, row.cardFee, label, null);
      addXp(row, otherSource(row.category), row.otherXp, 0, label, null);
      addXp(row, 'SAF', row.safXp, row.safPrice, label, null);
      if (row.flightXp) warnings.push(`Row ${row.line}: flight XP without a route (${row.flightXp} XP) was not imported.`);
      continue;
    }

    const cabin = cabinFromCategory(row.category);
    if (!cabin) warnings.push(`Row ${row.line}: unknown cabin "${row.category}", imported as Economy.`);

    // Price > 0 starts a new ticket; otherwise continue the most recent open ticket
    // whose last airport is this flight's origin.
    let group = row.price > 0 ? undefined : [...groups].reverse().find((g) => !g.closed && g.last === row.origin);
    if (!group) {
      const bookingId = idFor(`booking|${row.date}|${row.origin}|${row.destination}`);
      group = {
        booking: {
          id: bookingId,
          booking_name: '',
          purchase_date: row.date,
          category: options.category,
          total_price: 0,
          currency: options.currency,
          status: 'Booked',
          notes: NOTE,
        },
        segments: [],
        start: row.origin!,
        last: row.origin!,
        closed: false,
      };
      groups.push(group);
    }

    const isCredited = credited(row.date);
    group.booking.total_price += row.price;
    group.segments.push({
      id: idFor(`segment|${row.date}|${row.origin}|${row.destination}`),
      booking_id: group.booking.id,
      position: group.segments.length,
      flight_date: row.date,
      origin_iata: row.origin!,
      destination_iata: row.destination!,
      marketing_airline: options.airline,
      cabin: cabin ?? 'Economy',
      expected_xp: row.flightXp,
      actual_xp: isCredited ? row.flightXp : null,
      segment_status: isCredited ? 'Flown' : 'Booked',
      notes: null,
    });
    group.last = row.destination!;
    if (row.destination === group.start) group.closed = true;

    addXp(row, 'SAF', row.safXp, row.safPrice, `SAF ${row.origin}–${row.destination}`, group.booking.id);
    addXp(row, 'Credit Card', row.cardXp, row.cardFee, row.category || 'Credit card', null);
    addXp(row, otherSource(row.category), row.otherXp, 0, row.category || 'Other', null);
  }

  for (const g of groups) {
    g.booking.booking_name = bookingName(g.segments);
    g.booking.status = g.segments.every((s) => s.segment_status === 'Flown') ? 'Flown' : 'Booked';
    g.booking.total_price = Math.round(g.booking.total_price * 100) / 100;
  }

  return {
    bookings: groups.map((g) => g.booking),
    segments: groups.flatMap((g) => g.segments),
    xpTransactions,
    warnings,
  };
}

// --- Qualification cycles --------------------------------------------------------

export interface SuggestedCycle {
  id: string;
  name: string;
  start_date: IsoDate;
  end_date: IsoDate;
  starting_status: FlyingBlueStatus;
  target_xp: number;
  carried_over_xp: number;
  notes: string;
}


/**
 * Reconstructs qualification cycles from credited XP using the Flying Blue mechanics:
 * a period lasts 12 months; reaching the next level ends it at the end of that month,
 * a new period starts on the 1st of the following month and the XP above the threshold
 * carries over. At the end of a full 12 months the level is kept (surplus carries) or
 * lowered by one step (counter restarts at 0). Only credited XP is used, so the current
 * cycle is never shortened by trips that have not happened yet.
 */
export function suggestCycles(
  events: { date: IsoDate; xp: number }[],
  options: { startStatus: FlyingBlueStatus; startMonth: string; today: IsoDate },
): SuggestedCycle[] {
  const byMonth = new Map<string, number>();
  for (const e of events) {
    if (e.date > options.today) continue;
    byMonth.set(monthKey(e.date), (byMonth.get(monthKey(e.date)) ?? 0) + e.xp);
  }
  const currentMonth = monthKey(options.today);
  const cycles: SuggestedCycle[] = [];
  let level = options.startStatus;
  let carry = 0;
  let start = options.startMonth;

  const push = (from: string, toMonth: string, lvl: FlyingBlueStatus, carried: number) => {
    const start_date = firstDayOfMonth(from);
    cycles.push({
      id: stableUuid(`cycle|${start_date}|${lvl}`),
      name: `FB ${lvl} ${from}`,
      start_date,
      end_date: lastDayOfMonth(toMonth),
      starting_status: lvl,
      target_xp: levelTarget(lvl),
      carried_over_xp: Math.max(Math.round(carried), 0),
      notes: 'Suggested from imported XP history',
    });
  };

  for (let guard = 0; guard < 100; guard++) {
    let cumulative = carry;
    let upgradedAt: string | null = null;
    for (let i = 0; i < 12; i++) {
      const m = addMonths(start, i);
      if (m > currentMonth) {
        push(start, addMonths(start, 11), level, carry);
        return cycles;
      }
      cumulative += byMonth.get(m) ?? 0;
      const next = nextLevel(level);
      if (next && cumulative >= LEVEL_THRESHOLDS[next]) {
        upgradedAt = m;
        break;
      }
    }
    if (upgradedAt) {
      const next = nextLevel(level)!;
      push(start, upgradedAt, level, carry);
      carry = cumulative - LEVEL_THRESHOLDS[next];
      level = next;
      start = addMonths(upgradedAt, 1);
      continue;
    }
    // Full 12 months without reaching the next level: requalify or step down.
    push(start, addMonths(start, 11), level, carry);
    const keep = LEVEL_THRESHOLDS[level];
    if (level === 'Explorer') carry = 0;
    else if (cumulative >= keep) carry = cumulative - keep;
    else {
      level = lowerLevel(level);
      carry = 0;
    }
    start = addMonths(start, 12);
  }
  return cycles;
}

/** Credited XP events (flights + non-flight XP) from a plan, for suggestCycles. */
export function creditedXpEvents(plan: ImportPlan): { date: IsoDate; xp: number }[] {
  return [
    ...plan.segments.filter((s) => s.actual_xp != null).map((s) => ({ date: s.flight_date, xp: s.actual_xp! })),
    ...plan.xpTransactions.filter((t) => t.actual_xp != null).map((t) => ({ date: t.transaction_date, xp: t.actual_xp! })),
  ];
}
