// Columns included in exports and accepted on import, per table, in dependency order.
// user_id is never exported/imported: rows always belong to the signed-in user.
export const BACKUP_TABLES = {
  user_settings: [
    'preferred_currency', 'home_airport', 'default_airline', 'default_cabin', 'default_category',
    'current_status', 'xp_target', 'theme',
  ],
  qualification_cycles: ['id', 'name', 'start_date', 'end_date', 'starting_status', 'target_xp', 'carried_over_xp', 'notes', 'created_at'],
  bookings: [
    'id', 'booking_reference', 'ticket_number', 'booking_name', 'purchase_date', 'category', 'total_price', 'currency',
    'baseline_alternative_price', 'notes', 'status', 'archived_at', 'created_at',
  ],
  flight_segments: [
    'id', 'booking_id', 'position', 'flight_date', 'flight_number', 'origin_iata', 'destination_iata',
    'marketing_airline', 'operating_airline', 'cabin', 'fare_class', 'expected_xp', 'actual_xp', 'segment_status',
    'notes', 'archived_at', 'created_at',
  ],
  xp_transactions: [
    'id', 'booking_id', 'transaction_date', 'source_type', 'description', 'cost', 'currency', 'expected_xp',
    'actual_xp', 'status', 'notes', 'archived_at', 'created_at',
  ],
  credits: [
    'id', 'booking_id', 'transaction_date', 'credit_type', 'description', 'amount', 'currency', 'include_in_net_cost',
    'notes', 'archived_at', 'created_at',
  ],
  xp_rules: [
    'id', 'effective_from', 'effective_to', 'route_category', 'is_domestic', 'min_distance_miles',
    'max_distance_miles', 'cabin', 'xp', 'notes', 'created_at',
  ],
  exchange_rates: ['id', 'from_currency', 'to_currency', 'rate', 'effective_from', 'notes', 'created_at'],
} as const;

export type BackupTable = keyof typeof BACKUP_TABLES;

/** Tables offered as individual CSV downloads. */
export const CSV_TABLES = ['bookings', 'flight_segments', 'xp_transactions', 'credits', 'qualification_cycles'] as const;
export type CsvTable = (typeof CSV_TABLES)[number];
