'use client';
import { useCallback, useTransition } from 'react';
import type { ActionResult } from '@/lib/action-result';
import { DEMO_READ_ONLY, isDemo } from '@/lib/demo';
import { useReload } from '@/components/data/tracker-context';
import { useToast } from './Toast';

/**
 * Runs a database change inside a transition, reloads the data on success and shows
 * a success/error toast. Returns the result so callers can navigate or reset forms.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const reload = useReload();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, successMessage?: string): Promise<ActionResult<T>> =>
      new Promise((resolve) => {
        // The database would refuse it anyway (anon is read-only); say why up front.
        if (isDemo()) {
          toast(DEMO_READ_ONLY, 'error');
          resolve({ ok: false, error: DEMO_READ_ONLY });
          return;
        }
        startTransition(async () => {
          try {
            const result = await action();
            if (result.ok) {
              await reload();
              if (successMessage) toast(successMessage, 'success');
            } else {
              toast(result.error, 'error');
            }
            resolve(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Something went wrong.';
            toast(message, 'error');
            resolve({ ok: false, error: message });
          }
        });
      }),
    [toast, reload],
  );

  return { pending, run };
}
