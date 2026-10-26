'use client';
import { useState } from 'react';
import { deleteXpRule, installDefaultXpRules, saveXpRule } from '@/lib/store/settings';
import { CABINS, type Cabin, type XpRule } from '@/domain/types';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Button } from '@/components/ui/primitives';
import { useAction } from '@/components/ui/useAction';

interface RuleDraft {
  effective_from: string;
  effective_to: string;
  route_category: string;
  is_domestic: boolean;
  min_distance_miles: string;
  max_distance_miles: string;
  cabin: Cabin;
  xp: string;
  notes: string;
}

function toDraft(r: XpRule): RuleDraft {
  return {
    effective_from: r.effective_from,
    effective_to: r.effective_to ?? '',
    route_category: r.route_category,
    is_domestic: r.is_domestic,
    min_distance_miles: r.min_distance_miles == null ? '' : String(r.min_distance_miles),
    max_distance_miles: r.max_distance_miles == null ? '' : String(r.max_distance_miles),
    cabin: r.cabin,
    xp: String(r.xp),
    notes: r.notes ?? '',
  };
}

function band(r: XpRule): string {
  if (r.is_domestic) return 'same country';
  if (r.min_distance_miles != null && r.max_distance_miles != null) return `${r.min_distance_miles}–${r.max_distance_miles} mi`;
  if (r.min_distance_miles != null) return `≥ ${r.min_distance_miles} mi`;
  if (r.max_distance_miles != null) return `< ${r.max_distance_miles} mi`;
  return 'any distance';
}

/**
 * The XP chart as editable data. Rules are grouped by category; each row is one
 * cabin. When Flying Blue changes the chart, add rules with a new effective date.
 */
export function RulesManager({ rules }: { rules: XpRule[] }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const sorted = [...rules].sort(
    (a, b) =>
      b.effective_from.localeCompare(a.effective_from) ||
      Number(b.is_domestic) - Number(a.is_domestic) ||
      (a.min_distance_miles ?? 0) - (b.min_distance_miles ?? 0) ||
      CABINS.indexOf(a.cabin) - CABINS.indexOf(b.cabin),
  );
  const blank: RuleDraft = {
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    route_category: '',
    is_domestic: false,
    min_distance_miles: '',
    max_distance_miles: '',
    cabin: 'Economy',
    xp: '',
    notes: '',
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">
        Used by the XP calculator and to prefill expected XP. The defaults follow the Flying Blue revenue chart (domestic, then distance bands
        in miles). Always check the current chart on flyingblue.com; manual XP always wins.
      </p>

      {rules.length === 0 ? (
        <Button variant="primary" className="self-start" pending={pending} onClick={() => run(() => installDefaultXpRules(false), 'Default chart installed')}>
          Install default Flying Blue chart
        </Button>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Applies to</th>
                <th className="pb-2 font-medium">Cabin</th>
                <th className="pb-2 text-right font-medium">XP</th>
                <th className="pb-2 font-medium">Effective</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) =>
                editing === r.id ? (
                  <tr key={r.id} className="border-t border-line">
                    <td colSpan={6} className="py-2">
                      <RuleEditor id={r.id} initial={toDraft(r)} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1.5 font-medium">{r.route_category}</td>
                    <td className="py-1.5 text-ink-2">{band(r)}</td>
                    <td className="py-1.5">{r.cabin}</td>
                    <td className="py-1.5 text-right font-semibold tabular">{r.xp}</td>
                    <td className="py-1.5 text-xs text-muted">
                      {r.effective_from}
                      {r.effective_to ? ` → ${r.effective_to}` : ' →'}
                    </td>
                    <td className="py-1.5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing === 'new' ? (
        <div className="rounded-xl border border-line p-3">
          <RuleEditor id={null} initial={blank} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing('new')}>+ Add rule</Button>
          {rules.length > 0 ? (
            <ConfirmButton
              variant="ghost"
              size="md"
              title="Reset XP rules to the default chart?"
              message="All your rules are replaced by the default Flying Blue chart. Existing expected and actual XP on your flights do not change."
              confirmLabel="Reset rules"
              onConfirm={() => run(() => installDefaultXpRules(true), 'XP rules reset')}
            >
              Reset to defaults
            </ConfirmButton>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RuleEditor({ id, initial, onDone }: { id: string | null; initial: RuleDraft; onDone: () => void }) {
  const { pending, run } = useAction();
  const [d, setD] = useState(initial);
  const set = (patch: Partial<RuleDraft>) => setD((x) => ({ ...x, ...patch }));
  const small = 'input !min-h-9 !py-1 text-sm';
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input className={small} aria-label="Route category" placeholder="Category (e.g. Long 1)" value={d.route_category} onChange={(e) => set({ route_category: e.target.value })} />
        <select className={small} aria-label="Cabin" value={d.cabin} onChange={(e) => set({ cabin: e.target.value as Cabin })}>
          {CABINS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className={small} aria-label="XP" inputMode="numeric" placeholder="XP" value={d.xp} onChange={(e) => set({ xp: e.target.value.replace(/[^\d]/g, '') })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.is_domestic} onChange={(e) => set({ is_domestic: e.target.checked })} className="accent-[var(--accent)]" />
          Domestic (same country)
        </label>
        {!d.is_domestic ? (
          <>
            <input className={small} aria-label="Min distance (miles)" inputMode="numeric" placeholder="Min miles" value={d.min_distance_miles} onChange={(e) => set({ min_distance_miles: e.target.value.replace(/[^\d]/g, '') })} />
            <input className={small} aria-label="Max distance (miles)" inputMode="numeric" placeholder="Max miles (exclusive)" value={d.max_distance_miles} onChange={(e) => set({ max_distance_miles: e.target.value.replace(/[^\d]/g, '') })} />
          </>
        ) : null}
        <input type="date" className={small} aria-label="Effective from" value={d.effective_from} onChange={(e) => set({ effective_from: e.target.value })} />
        <input type="date" className={small} aria-label="Effective to" value={d.effective_to} onChange={(e) => set({ effective_to: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        {id ? (
          <ConfirmButton variant="ghost" title="Delete this rule?" confirmLabel="Delete" onConfirm={() => run(() => deleteXpRule(id), 'Rule deleted').then(onDone)}>
            Delete
          </ConfirmButton>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          pending={pending}
          onClick={async () => {
            const r = await run(
              () =>
                saveXpRule(id, {
                  ...d,
                  xp: Number(d.xp || 0),
                  effective_to: d.effective_to || null,
                  min_distance_miles: d.is_domestic ? null : d.min_distance_miles,
                  max_distance_miles: d.is_domestic ? null : d.max_distance_miles,
                  notes: d.notes || null,
                }),
              'Rule saved',
            );
            if (r.ok) onDone();
          }}
        >
          Save rule
        </Button>
      </div>
    </div>
  );
}
