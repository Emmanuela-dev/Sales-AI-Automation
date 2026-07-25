import { SearchInterface } from '@/components/search/search-interface';

export default function SearchPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find Businesses</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search any industry, city, or keyword. AI will discover and qualify prospects automatically.
        </p>
      </div>
      <SearchInterface />
    </div>
  );
}
