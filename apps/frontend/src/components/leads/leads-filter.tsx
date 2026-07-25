'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLeadFilters } from '@/hooks/use-lead-filters';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useEffect, useState } from 'react';

const STATUSES = [
  { value: 'all',         label: 'All' },
  { value: 'qualified',   label: 'Qualified' },
  { value: 'contacted',   label: 'Contacted' },
  { value: 'meeting',     label: 'Meeting' },
  { value: 'proposal',    label: 'Proposal' },
  { value: 'won',         label: 'Won' },
  { value: 'lost',        label: 'Lost' },
];

export function LeadsFilter() {
  const { filters, setFilter } = useLeadFilters();
  const [nameInput, setNameInput] = useState('');
  const debouncedName = useDebounce(nameInput, 400);

  useEffect(() => {
    setFilter('name', debouncedName || undefined);
  }, [debouncedName]);

  const activeFiltersCount = Object.keys(filters).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search by name..."
            className="w-52 h-9 pl-8 text-sm"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            aria-label="Filter leads by name"
          />
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATUSES.map(s => {
            const isActive = filters.status === s.value || (!filters.status && s.value === 'all');
            return (
              <Button
                key={s.value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="h-9 text-xs"
                onClick={() => setFilter('status', s.value === 'all' ? undefined : s.value)}
                aria-pressed={isActive}
              >
                {s.label}
              </Button>
            );
          })}
        </div>

        {/* High-value toggle */}
        <Button
          variant={filters.min_score ? 'default' : 'outline'}
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => setFilter('min_score', filters.min_score ? undefined : '75')}
          aria-pressed={!!filters.min_score}
        >
          {filters.min_score && <Badge variant="secondary" className="h-4 px-1 text-[10px]">75+</Badge>}
          High-value only
        </Button>

        {/* Clear all */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground gap-1"
            onClick={() => {
              setFilter('status', undefined);
              setFilter('min_score', undefined);
              setFilter('name', undefined);
              setNameInput('');
            }}
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
