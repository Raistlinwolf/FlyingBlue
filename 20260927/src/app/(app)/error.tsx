'use client';
import { Button } from '@/components/ui/primitives';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-2">{error.message || 'The page could not be loaded.'}</p>
      <Button variant="primary" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
