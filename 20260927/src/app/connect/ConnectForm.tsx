'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { type SupabaseConfig, clearConfig, connectionFromLink, saveConfig, testConnection, useConfig } from '@/lib/supabase/client';
import { Button, Card, Field, Notice } from '@/components/ui/primitives';

const LOCAL_URL = 'http://127.0.0.1:54321';

/**
 * Where the data lives. The URL and publishable key are stored only in this browser,
 * so the public site never contains connection details.
 */
export function ConnectForm() {
  const config = useConfig();
  if (config === undefined) return null; // prerender: the saved connection lives in the browser
  return <ConnectFields key={config ? `${config.url}|${config.key}` : 'none'} initial={config} />;
}

function ConnectFields({ initial }: { initial: SupabaseConfig | null }) {
  const router = useRouter();
  // A shared connection link (…/connect/#connect=…) pre-fills the form.
  const [fromLink] = useState(() => connectionFromLink());
  const [url, setUrl] = useState(fromLink?.url ?? initial?.url ?? LOCAL_URL);
  const [key, setKey] = useState(fromLink?.key ?? initial?.key ?? '');

  useEffect(() => {
    // Keep the key out of the address bar and history once it has been read.
    if (fromLink) window.history.replaceState(null, '', window.location.pathname);
  }, [fromLink]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const next = { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
    if (!/^https?:\/\//.test(next.url) || !next.key) {
      setError('Enter the API URL (http://… or https://…) and the publishable key.');
      return;
    }
    startTransition(async () => {
      const problem = await testConnection(next);
      if (problem) {
        setError(problem);
        return;
      }
      saveConfig(next);
      router.replace('/login');
    });
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {fromLink ? <Notice tone="info">Filled in from a connection link — press Connect.</Notice> : null}
        <Field label="Supabase API URL" hint="Local Supabase: http://127.0.0.1:54321">
          <input className="input font-mono text-sm" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Publishable key" hint="From `npx supabase status` (Publishable key) or the project's API settings.">
          <input
            className="input font-mono text-sm"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sb_publishable_…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" pending={pending}>
          Connect
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2 text-xs text-ink-2">
        <Notice tone="info">
          Stored only in this browser. Never enter the secret / service-role key — the publishable key is safe because Row Level Security
          protects your data.
        </Notice>
        <p>
          Using a database on this computer from the online site? Your browser may ask to allow access to devices on your local network —
          choose <strong>Allow</strong>.
        </p>
        {initial ? (
          <button type="button" className="self-start text-muted underline-offset-2 hover:underline" onClick={clearConfig}>
            Forget saved connection
          </button>
        ) : null}
      </div>
    </Card>
  );
}
