import Image from 'next/image';
import { asset } from '@/lib/base-path';

/** Centered layout for the signed-out screens (login, connect, confirm). */
export function AuthScreen({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image src={asset('/icon.svg')} alt="" width={44} height={44} className="rounded-xl" unoptimized priority />
          <div>
            <h1 className="text-xl font-semibold">XP Tracker</h1>
            <p className="text-sm text-ink-2">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
