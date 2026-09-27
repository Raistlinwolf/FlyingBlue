'use client';
import { useEffect, useState } from 'react';
import { type RegistrationStatus, loadRegistrationStatus, setEmailAllowed, setRegistrationOpen } from '@/lib/store/admin';
import { Toggle } from '@/components/forms/inputs';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button, Field, Notice } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

/** Admin only: open/close registration and manage the emails allowed to register. */
export function AdminPanel() {
  const { pending, run } = useAction();
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function refresh() {
    const r = await loadRegistrationStatus();
    if (r.ok) setStatus(r.data);
    else setError(r.error);
  }

  useEffect(() => {
    let active = true;
    loadRegistrationStatus().then((r) => {
      if (!active) return;
      if (r.ok) setStatus(r.data);
      else setError(r.error);
    });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Notice>{error}</Notice>;
  if (!status) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Toggle
        label={status.registrationOpen ? 'Registration is OPEN' : 'Registration is closed'}
        hint={
          status.registrationOpen
            ? 'Anyone who opens the site can create an account right now. Close it again when done.'
            : 'Only the emails below can create an account.'
        }
        checked={status.registrationOpen}
        onChange={async (open) => {
          const r = await run(() => setRegistrationOpen(open), open ? 'Registration opened' : 'Registration closed');
          if (r.ok) await refresh();
        }}
      />
      {status.registrationOpen ? <Notice>Registration is open to everyone.</Notice> : null}

      <div>
        <p className="mb-1 font-medium">Allowed to register</p>
        {status.allowlist.length === 0 ? (
          <p className="text-xs text-muted">No invited emails.</p>
        ) : (
          <ul className="mb-2 divide-y divide-line rounded-xl border border-line">
            {status.allowlist.map((e) => (
              <li key={e} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="font-mono text-xs">{e}</span>
                <ConfirmButton
                  variant="ghost"
                  title={`Remove ${e}?`}
                  message="Existing accounts are not affected; this only stops a new registration."
                  confirmLabel="Remove"
                  onConfirm={async () => {
                    const r = await run(() => setEmailAllowed(e, false), 'Removed');
                    if (r.ok) await refresh();
                  }}
                >
                  Remove
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const r = await run(() => setEmailAllowed(email, true), 'Email can now register');
            if (r.ok) {
              setEmail('');
              await refresh();
            }
          }}
        >
          <Field label="Invite an email" className="flex-1">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
          </Field>
          <Button type="submit" pending={pending} disabled={!email}>
            Allow
          </Button>
        </form>
      </div>
    </div>
  );
}
