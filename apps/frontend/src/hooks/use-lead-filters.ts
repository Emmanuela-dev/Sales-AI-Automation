import { useState } from 'react';

interface LeadFilters {
  status?: string;
  min_score?: string;
  name?: string;
}

export function useLeadFilters() {
  const [filters, setFilters] = useState<LeadFilters>({});

  function setFilter(key: keyof LeadFilters, value: string | undefined) {
    setFilters(prev => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  return { filters, setFilter };
}
