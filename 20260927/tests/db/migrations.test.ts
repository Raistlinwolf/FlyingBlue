// Applies every migration to an embedded Postgres and checks the security model:
// signup allowlist, per-user defaults, RLS isolation and integrity constraints.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');

let db: PGlite;
let userA: string;
let userB: string;

async function asUser(userId: string | null, fn: () => Promise<void>) {
  await db.exec(userId ? 'set role authenticated' : 'set role anon');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  try {
    await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function createUser(email: string): Promise<string> {
  const res = await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email]);
  return res.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(__dirname, 'supabase-stub.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.query(`insert into private.signup_allowlist (email) values ('a@example.com'), ('b@example.com')`);
  userA = await createUser('A@example.com');
  userB = await createUser('b@example.com');
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('migrations', () => {
  it('seeds the airports reference table', async () => {
    const res = await db.query<{ n: number }>('select count(*)::int as n from public.airports');
    expect(res.rows[0].n).toBeGreaterThan(5000);
    const ams = await db.query<{ country_code: string }>(`select country_code from public.airports where iata = 'AMS'`);
    expect(ams.rows[0].country_code).toBe('NL');
  });

  it('rejects registrations that are not on the allowlist', async () => {
    await expect(createUser('intruder@example.com')).rejects.toThrow(/SIGNUP_NOT_ALLOWED/);
  });

  it('creates settings and the default XP chart for new users', async () => {
    const settings = await db.query('select * from public.user_settings where user_id = $1', [userA]);
    expect(settings.rows).toHaveLength(1);
    const rules = await db.query<{ n: number }>('select count(*)::int as n from public.xp_rules where user_id = $1', [userA]);
    expect(rules.rows[0].n).toBe(20);
  });
});

describe('row level security', () => {
  let bookingA: string;

  it('lets a user create and read their own rows', async () => {
    await asUser(userA, async () => {
      const booking = await db.query<{ id: string }>(
        `insert into public.bookings (booking_name, total_price, currency) values ('XP run', 399, 'EUR') returning id`,
      );
      bookingA = booking.rows[0].id;
      await db.query(
        `insert into public.flight_segments (booking_id, flight_date, origin_iata, destination_iata, marketing_airline, expected_xp)
         values ($1, '2027-01-02', 'AMS', 'CPH', 'KL', 5)`,
        [bookingA],
      );
      const rows = await db.query('select * from public.flight_segments');
      expect(rows.rows).toHaveLength(1);
    });
  });

  it('hides other users rows and blocks writes to them', async () => {
    await asUser(userB, async () => {
      expect((await db.query('select * from public.bookings')).rows).toHaveLength(0);
      expect((await db.query('select * from public.flight_segments')).rows).toHaveLength(0);
      const upd = await db.query(`update public.bookings set total_price = 0 where id = $1`, [bookingA]);
      expect(upd.affectedRows ?? 0).toBe(0);
      const del = await db.query(`delete from public.bookings where id = $1`, [bookingA]);
      expect(del.affectedRows ?? 0).toBe(0);
    });
  });

  it('prevents attaching rows to another users booking', async () => {
    await asUser(userB, async () => {
      await expect(
        db.query(
          `insert into public.flight_segments (booking_id, flight_date, origin_iata, destination_iata, marketing_airline)
           values ($1, '2027-01-02', 'CPH', 'ARN', 'SK')`,
          [bookingA],
        ),
      ).rejects.toThrow();
    });
  });

  it('prevents inserting rows owned by someone else', async () => {
    await asUser(userB, async () => {
      await expect(
        db.query(`insert into public.bookings (user_id, booking_name) values ($1, 'spoof')`, [userA]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('denies anonymous access', async () => {
    await asUser(null, async () => {
      await expect(db.query('select * from public.bookings')).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from public.airports')).rejects.toThrow(/permission denied/);
    });
  });

  it('lets users reinstall the default XP chart for themselves only', async () => {
    await asUser(userB, async () => {
      const res = await db.query<{ n: number }>('select public.install_default_xp_rules(true) as n');
      expect(res.rows[0].n).toBe(20);
    });
    const a = await db.query<{ n: number }>('select count(*)::int as n from public.xp_rules where user_id = $1', [userA]);
    expect(a.rows[0].n).toBe(20);
  });
});

describe('constraints', () => {
  it('rejects overlapping qualification cycles but allows adjacent ones', async () => {
    await asUser(userA, async () => {
      await db.query(
        `insert into public.qualification_cycles (name, start_date, end_date, target_xp) values ('FB 2027', '2027-04-01', '2028-03-31', 300)`,
      );
      await db.query(
        `insert into public.qualification_cycles (name, start_date, end_date, target_xp) values ('FB 2028', '2028-04-01', '2029-03-31', 300)`,
      );
      await expect(
        db.query(
          `insert into public.qualification_cycles (name, start_date, end_date) values ('Overlap', '2028-03-31', '2028-06-30')`,
        ),
      ).rejects.toThrow(/qualification_cycles_no_overlap/);
    });
    // The other user's cycles are independent.
    await asUser(userB, async () => {
      await db.query(
        `insert into public.qualification_cycles (name, start_date, end_date) values ('Mine', '2027-06-01', '2028-05-31')`,
      );
    });
  });

  it('rejects impossible segments', async () => {
    await asUser(userA, async () => {
      const booking = await db.query<{ id: string }>(`insert into public.bookings (booking_name) values ('x') returning id`);
      await expect(
        db.query(
          `insert into public.flight_segments (booking_id, flight_date, origin_iata, destination_iata, marketing_airline)
           values ($1, '2027-01-02', 'AMS', 'AMS', 'KL')`,
          [booking.rows[0].id],
        ),
      ).rejects.toThrow(/flight_segments_route_valid/);
      await expect(
        db.query(
          `insert into public.flight_segments (booking_id, flight_date, origin_iata, destination_iata, marketing_airline)
           values ($1, '2027-01-02', 'ams', 'CPH', 'KL')`,
          [booking.rows[0].id],
        ),
      ).rejects.toThrow(/origin_iata_check/);
    });
  });

  it('unlinks XP transactions and credits when a booking is permanently deleted', async () => {
    await asUser(userA, async () => {
      const booking = await db.query<{ id: string }>(`insert into public.bookings (booking_name) values ('tmp') returning id`);
      const id = booking.rows[0].id;
      await db.query(
        `insert into public.xp_transactions (booking_id, source_type, cost, expected_xp) values ($1, 'SAF', 60, 12)`,
        [id],
      );
      await db.query(`insert into public.credits (booking_id, credit_type, amount) values ($1, 'Ticket Refund', 50)`, [id]);
      await db.query('delete from public.bookings where id = $1', [id]);
      const txn = await db.query<{ booking_id: string | null; user_id: string }>(
        `select booking_id, user_id from public.xp_transactions where source_type = 'SAF'`,
      );
      expect(txn.rows[0].booking_id).toBeNull();
      expect(txn.rows[0].user_id).toBe(userA);
    });
  });
});
