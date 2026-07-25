'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const STATUSES = [
  { value: 'discovered',  label: 'Discovered' },
  { value: 'analyzing',   label: 'Analyzing' },
  { value: 'qualified',   label: 'Qualified' },
  { value: 'contacted',   label: 'Contacted' },
  { value: 'meeting',     label: 'Meeting' },
  { value: 'proposal',    label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiating' },
  { value: 'won',         label: '✓ Won' },
  { value: 'lost',        label: '✗ Lost' },
];

interface Props {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  loading?: boolean;
}

export function LeadStatusSelect({ currentStatus, onStatusChange, loading }: Props) {
  return (
    <div className="flex items-center gap-2">
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving..." />}
      <Select value={currentStatus} onValueChange={onStatusChange} disabled={loading}>
        <SelectTrigger className="w-44" aria-label="Change lead status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
