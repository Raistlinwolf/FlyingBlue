// Row shapes as returned by Supabase. Numeric columns arrive as numbers or strings
// depending on the driver, so money fields are typed loosely and read via toNumber().

export const BOOKING_CATEGORIES = [
  'XP Run',
  'Personal Travel',
  'Business Travel',
  'Positioning',
  'Award Travel',
  'Other',
] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

export const TRAVEL_STATUSES = ['Planned', 'Booked', 'Flown', 'Cancelled'] as const;
export type TravelStatus = (typeof TRAVEL_STATUSES)[number];

export const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'] as const;
export type Cabin = (typeof CABINS)[number];

export const XP_SOURCE_TYPES = [
  'SAF',
  'Credit Card',
  'Promotion',
  'Choice Benefit',
  'Partner',
  'Adjustment',
  'Other',
] as const;
export type XpSourceType = (typeof XP_SOURCE_TYPES)[number];

export const XP_TRANSACTION_STATUSES = ['Planned', 'Pending', 'Credited', 'Cancelled'] as const;
export type XpTransactionStatus = (typeof XP_TRANSACTION_STATUSES)[number];

export const CREDIT_TYPES = [
  'Ticket Refund',
  'Airline Compensation',
  'EC261 Compensation',
  'Expense Reimbursement',
  'Statement Credit',
  'Voucher',
  'Other',
] as const;
export type CreditType = (typeof CREDIT_TYPES)[number];

export const FB_STATUSES = ['Explorer', 'Silver', 'Gold', 'Platinum', 'Ultimate'] as const;
export type FlyingBlueStatus = (typeof FB_STATUSES)[number];

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** ISO date, YYYY-MM-DD. Compared as strings. */
export type IsoDate = string;
type Numeric = number | string;

export interface Booking {
  id: string;
  booking_reference: string | null;
  ticket_number: string | null;
  booking_name: string;
  purchase_date: IsoDate;
  category: BookingCategory;
  total_price: Numeric;
  currency: string;
  baseline_alternative_price: Numeric | null;
  notes: string | null;
  status: TravelStatus;
  archived_at: string | null;
  created_at?: string;
}

export interface FlightSegment {
  id: string;
  booking_id: string;
  position: number;
  flight_date: IsoDate;
  flight_number: string | null;
  origin_iata: string;
  destination_iata: string;
  marketing_airline: string;
  operating_airline: string | null;
  cabin: Cabin;
  fare_class: string | null;
  expected_xp: number;
  actual_xp: number | null;
  segment_status: TravelStatus;
  notes: string | null;
  archived_at: string | null;
  created_at?: string;
}

export interface XpTransaction {
  id: string;
  booking_id: string | null;
  transaction_date: IsoDate;
  source_type: XpSourceType;
  description: string | null;
  cost: Numeric;
  currency: string;
  expected_xp: number;
  actual_xp: number | null;
  status: XpTransactionStatus;
  notes: string | null;
  archived_at: string | null;
  created_at?: string;
}

export interface Credit {
  id: string;
  booking_id: string | null;
  transaction_date: IsoDate;
  credit_type: CreditType;
  description: string | null;
  amount: Numeric;
  currency: string;
  include_in_net_cost: boolean;
  notes: string | null;
  archived_at: string | null;
  created_at?: string;
}

export interface QualificationCycle {
  id: string;
  name: string;
  start_date: IsoDate;
  end_date: IsoDate;
  starting_status: FlyingBlueStatus;
  target_xp: number;
  /** Surplus XP rolled over from the previous cycle. */
  carried_over_xp: number;
  notes: string | null;
}

export interface XpRule {
  id: string;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
  route_category: string;
  is_domestic: boolean;
  min_distance_miles: number | null;
  max_distance_miles: number | null;
  cabin: Cabin;
  xp: number;
  notes: string | null;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: Numeric;
  effective_from: IsoDate;
  notes: string | null;
}

export interface Airport {
  iata: string;
  name: string;
  city: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
}

export interface UserSettings {
  preferred_currency: string;
  home_airport: string | null;
  default_airline: string | null;
  default_cabin: Cabin;
  default_category: BookingCategory;
  current_status: FlyingBlueStatus;
  xp_target: number;
  theme: Theme;
}

export const DEFAULT_SETTINGS: UserSettings = {
  preferred_currency: 'EUR',
  home_airport: null,
  default_airline: null,
  default_cabin: 'Economy',
  default_category: 'XP Run',
  current_status: 'Explorer',
  xp_target: 300,
  theme: 'system',
};

/** Everything the dashboard, calendar and history need, loaded once per request. */
export interface TrackerData {
  bookings: Booking[];
  segments: FlightSegment[];
  xpTransactions: XpTransaction[];
  credits: Credit[];
  exchangeRates: ExchangeRate[];
}

export function toNumber(value: Numeric | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
