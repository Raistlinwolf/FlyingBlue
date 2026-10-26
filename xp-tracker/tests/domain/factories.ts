import type {
  Booking,
  Credit,
  FlightSegment,
  QualificationCycle,
  TrackerData,
  XpRule,
  XpTransaction,
} from '@/domain/types';

let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

export function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: id('booking'),
    booking_reference: null,
    ticket_number: null,
    booking_name: 'Test booking',
    purchase_date: '2027-01-01',
    category: 'XP Run',
    total_price: 0,
    currency: 'EUR',
    baseline_alternative_price: null,
    notes: null,
    status: 'Booked',
    archived_at: null,
    ...overrides,
  };
}

export function segment(bookingRow: Booking, overrides: Partial<FlightSegment> = {}): FlightSegment {
  return {
    id: id('segment'),
    booking_id: bookingRow.id,
    position: 0,
    flight_date: '2027-01-02',
    flight_number: null,
    origin_iata: 'AMS',
    destination_iata: 'CPH',
    marketing_airline: 'KL',
    operating_airline: null,
    cabin: 'Economy',
    fare_class: null,
    expected_xp: 5,
    actual_xp: null,
    segment_status: 'Booked',
    notes: null,
    archived_at: null,
    ...overrides,
  };
}

export function xpTxn(overrides: Partial<XpTransaction> = {}): XpTransaction {
  return {
    id: id('xp'),
    booking_id: null,
    transaction_date: '2027-01-02',
    source_type: 'SAF',
    description: null,
    cost: 0,
    currency: 'EUR',
    expected_xp: 0,
    actual_xp: null,
    status: 'Credited',
    notes: null,
    archived_at: null,
    ...overrides,
  };
}

export function credit(overrides: Partial<Credit> = {}): Credit {
  return {
    id: id('credit'),
    booking_id: null,
    transaction_date: '2027-01-10',
    credit_type: 'Ticket Refund',
    description: null,
    amount: 0,
    currency: 'EUR',
    include_in_net_cost: true,
    notes: null,
    archived_at: null,
    ...overrides,
  };
}

export function cycle(overrides: Partial<QualificationCycle> = {}): QualificationCycle {
  return {
    id: id('cycle'),
    name: 'FB 2027',
    start_date: '2027-04-01',
    end_date: '2028-03-31',
    starting_status: 'Platinum',
    target_xp: 300,
    carried_over_xp: 0,
    notes: null,
    ...overrides,
  };
}

export function data(overrides: Partial<TrackerData> = {}): TrackerData {
  return { bookings: [], segments: [], xpTransactions: [], credits: [], exchangeRates: [], ...overrides };
}

/** The default Flying Blue chart, mirroring the SQL defaults. */
export function defaultRules(): XpRule[] {
  const bands: [string, boolean, number | null, number | null, number[]][] = [
    ['Domestic', true, null, null, [2, 4, 6, 10]],
    ['Medium', false, 0, 2000, [5, 10, 15, 25]],
    ['Long 1', false, 2000, 3500, [8, 16, 24, 40]],
    ['Long 2', false, 3500, 5000, [10, 20, 30, 50]],
    ['Long 3', false, 5000, null, [12, 24, 36, 60]],
  ];
  const cabins = ['Economy', 'Premium Economy', 'Business', 'First'] as const;
  return bands.flatMap(([category, domestic, min, max, xp]) =>
    cabins.map((cabin, i) => ({
      id: id('rule'),
      effective_from: '2018-04-01',
      effective_to: null,
      route_category: category,
      is_domestic: domestic,
      min_distance_miles: min,
      max_distance_miles: max,
      cabin,
      xp: xp[i],
      notes: null,
    })),
  );
}
