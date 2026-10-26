'use client';
import { useRouter } from 'next/navigation';
import { type ArchivableTable, archiveRecord, deleteArchivedRecord, duplicateXpTransaction, restoreRecord } from '@/lib/store/records';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

/** Duplicate / archive / restore / permanently delete for a single record. */
export function RecordActions({
  table,
  id,
  archived,
  duplicate = false,
  compact = false,
}: {
  table: ArchivableTable;
  id: string;
  archived: boolean;
  duplicate?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const size = compact ? 'sm' : 'sm';

  if (archived) {
    return (
      <div className="flex gap-1">
        <Button size={size} variant="ghost" pending={pending} onClick={() => run(() => restoreRecord(table, id), 'Restored')}>
          Restore
        </Button>
        <ConfirmButton
          variant="ghost"
          title="Delete permanently?"
          message="This cannot be undone. Linked records are kept but unlinked."
          confirmLabel="Delete forever"
          onConfirm={() => run(() => deleteArchivedRecord(table, id), 'Deleted')}
        >
          Delete
        </ConfirmButton>
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      {duplicate && table === 'xp_transactions' ? (
        <Button
          size={size}
          variant="secondary"
          pending={pending}
          onClick={async () => {
            const r = await run(() => duplicateXpTransaction(id), 'Duplicated as planned');
            if (r.ok) router.push(`/xp?id=${r.data.id}`);
          }}
        >
          Duplicate
        </Button>
      ) : null}
      <ConfirmButton
        title="Archive this record?"
        message="It is removed from all totals. You can restore it from History → Show archived."
        confirmLabel="Archive"
        onConfirm={async () => {
          const r = await run(() => archiveRecord(table, id), 'Archived');
          if (r.ok && !compact) router.push('/history');
        }}
      >
        Archive
      </ConfirmButton>
    </div>
  );
}
