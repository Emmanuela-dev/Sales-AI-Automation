import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsFilter } from '@/components/leads/leads-filter';

export default function LeadsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All saved prospects with AI opportunity scores
          </p>
        </div>
      </div>
      <LeadsFilter />
      <LeadsTable />
    </div>
  );
}
