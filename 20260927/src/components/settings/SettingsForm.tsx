'use client';
import { useState } from 'react';
import { saveSettings } from '@/lib/store/settings';
import { BOOKING_CATEGORIES, CABINS, FB_STATUSES, THEMES, type UserSettings } from '@/domain/types';
import { AirportInput } from '@/components/forms/AirportInput';
import { AirlineInput, CurrencyInput, Segmented, Select } from '@/components/forms/inputs';
import { Button, Field } from '@/components/ui/primitives';
import { storeTheme } from '@/components/ui/theme';
import { useAction } from '@/components/ui/useAction';

export function SettingsForm({ settings }: { settings: UserSettings }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ ...settings, home_airport: settings.home_airport ?? '', default_airline: settings.default_airline ?? '', xp_target: String(settings.xp_target) });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));


  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Preferred currency" hint="Default for entries and reporting">
          <CurrencyInput label="Preferred currency" value={form.preferred_currency} onChange={(v) => set({ preferred_currency: v })} />
        </Field>
        <Field label="Home airport">
          <AirportInput label="Home airport" value={form.home_airport} onChange={(v) => set({ home_airport: v })} />
        </Field>
        <Field label="Default airline">
          <AirlineInput label="Default airline" value={form.default_airline} onChange={(v) => set({ default_airline: v })} />
        </Field>
        <Field label="Default XP target" hint="Used for calendar years and new cycles">
          <input className="input tabular" inputMode="numeric" value={form.xp_target} onChange={(e) => set({ xp_target: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <Field label="Current status">
          <Select label="Current status" value={form.current_status} options={FB_STATUSES} onChange={(v) => set({ current_status: v })} />
        </Field>
        <Field label="Default category">
          <Select label="Default category" value={form.default_category} options={BOOKING_CATEGORIES} onChange={(v) => set({ default_category: v })} />
        </Field>
        <Field label="Default cabin" className="col-span-2">
          <Segmented label="Default cabin" value={form.default_cabin} options={CABINS} onChange={(v) => set({ default_cabin: v })} />
        </Field>
      </div>
      <Field label="Theme">
        <Segmented
          label="Theme"
          value={form.theme}
          options={THEMES}
          short={{ system: 'System', light: 'Light', dark: 'Dark' }}
          onChange={(v) => {
            set({ theme: v });
            storeTheme(v);
          }}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          variant="primary"
          pending={pending}
          onClick={() =>
            run(
              () =>
                saveSettings({
                  ...form,
                  home_airport: form.home_airport || null,
                  default_airline: form.default_airline || null,
                  xp_target: Number(form.xp_target || 0),
                }),
              'Settings saved',
            )
          }
        >
          Save preferences
        </Button>
      </div>
    </div>
  );
}
