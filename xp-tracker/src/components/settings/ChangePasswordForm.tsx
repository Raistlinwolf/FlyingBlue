'use client';
import { useState } from 'react';
import { changePassword } from '@/lib/store/auth';
import { Button, Field } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

export function ChangePasswordForm({ email }: { email: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Change password
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() => changePassword({ email, ...form }), 'Password changed');
        if (r.ok) {
          setForm({ current: '', next: '', confirm: '' });
          setOpen(false);
        }
      }}
    >
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Current password">
          <input className="input" type="password" autoComplete="current-password" required value={form.current} onChange={(e) => set({ current: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={form.next} onChange={(e) => set({ next: e.target.value })} />
        </Field>
        <Field label="Repeat new password">
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={form.confirm} onChange={(e) => set({ confirm: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" pending={pending}>
          Save new password
        </Button>
      </div>
    </form>
  );
}
