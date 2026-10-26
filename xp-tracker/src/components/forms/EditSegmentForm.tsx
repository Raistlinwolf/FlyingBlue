'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateSegment } from '@/lib/store/travel';
import type { FlightSegment, XpRule } from '@/domain/types';
import { Button } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';
import { SegmentEditor } from './SegmentEditor';
import { type SegmentDraft, draftErrors, draftFromSegment, draftToInput } from './segment-draft';

export function EditSegmentForm({
  segment,
  rules,
  recentAirports,
  recentAirlines,
}: {
  segment: FlightSegment;
  rules: XpRule[];
  recentAirports: string[];
  recentAirlines: string[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [drafts, setDrafts] = useState<SegmentDraft[]>([draftFromSegment(segment)]);
  const [showErrors, setShowErrors] = useState(false);

  async function save() {
    setShowErrors(true);
    const d = drafts[0];
    if (Object.keys(draftErrors(d)).length > 0) return;
    const result = await run(() => updateSegment(segment.id, draftToInput(d)), 'Flight updated');
    if (result.ok) router.push(`/booking?id=${segment.booking_id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentEditor
        drafts={drafts}
        onChange={setDrafts}
        rules={rules}
        recentAirports={recentAirports}
        recentAirlines={recentAirlines}
        showErrors={showErrors}
        showActual
        allowMultiple={false}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" pending={pending} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
