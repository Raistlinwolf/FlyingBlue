import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-ink-2">This record does not exist or belongs to another account.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-accent-ink underline">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
