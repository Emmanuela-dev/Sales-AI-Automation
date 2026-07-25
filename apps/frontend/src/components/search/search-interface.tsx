'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchBusinesses, createLead } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search, Loader2, Globe, Phone, Star, MapPin,
  Plus, CheckCircle2, AlertCircle, Building2, Zap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BusinessResult {
  id: string;
  name: string;
  industry: string;
  city: string;
  country: string;
  website?: string;
  phone?: string;
  email?: string;
  google_rating?: number;
  google_reviews_count?: number;
}

interface SearchResult {
  businesses: BusinessResult[];
  total: number;
  query_summary: string;
}

const EXAMPLE_QUERIES = [
  'Hotels in Nairobi',
  'Law firms in Mombasa',
  'Restaurants in Kisii',
  'Schools in Eldoret',
  'Tech startups in Nairobi',
  'Salons in Westlands',
];

// The animated loading steps shown during search
const LOADING_STEPS = [
  'Searching Google Places...',
  'Collecting contact details...',
  'Checking for websites...',
  'Flagging digital gaps...',
  'Finalizing results...',
];

export function SearchInterface() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [loadingStep, setLoadingStep] = useState(0);
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: () => searchBusinesses({ query }),
    onSuccess: (data) => {
      setResults(data);
      setLoadingStep(0);
    },
    onError: () => {
      setLoadingStep(0);
      toast({
        title: 'Search failed',
        description: 'Could not search. Check your API keys or try again.',
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (business_id: string) => createLead({ business_id }),
    onSuccess: (_, business_id) => {
      setSavedLeads(prev => new Set([...prev, business_id]));
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead saved',
        description: 'AI scoring is running in the background.',
      });
    },
    onError: () => {
      toast({ title: 'Failed to save lead', variant: 'destructive' });
    },
  });

  // Animate loading steps
  useEffect(() => {
    if (!searchMutation.isPending) return;
    const interval = setInterval(() => {
      setLoadingStep(prev =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 900);
    return () => clearInterval(interval);
  }, [searchMutation.isPending]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setResults(null);
    setLoadingStep(0);
    searchMutation.mutate();
  }

  function handleSaveAll() {
    const unsaved = results?.businesses.filter(b => !savedLeads.has(b.id)) ?? [];
    unsaved.forEach(b => saveMutation.mutate(b.id));
  }

  const withWebsite = results?.businesses.filter(b => b.website).length ?? 0;
  const withoutWebsite = results?.businesses.filter(b => !b.website).length ?? 0;
  const highRating = results?.businesses.filter(b => (b.google_rating ?? 0) >= 4).length ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Search Form ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='e.g. "Hotels in Nairobi" or "Law firms in Mombasa"'
            className="pl-9 h-11 text-base"
            aria-label="Search for businesses"
            disabled={searchMutation.isPending}
          />
        </div>
        <Button
          type="submit"
          className="h-11 px-6 gap-2"
          disabled={searchMutation.isPending || query.trim().length < 2}
        >
          {searchMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Search className="h-4 w-4" aria-hidden="true" />
          }
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {/* ── Example Queries ── */}
      {!results && !searchMutation.isPending && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Try:</span>
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setQuery(q)}
              className="text-sm text-primary hover:underline underline-offset-2 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Animated Loading State ── */}
      {searchMutation.isPending && (
        <Card className="border-primary/20 bg-primary/5 animate-fade-in">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">AI is searching...</p>
            </div>
            <div className="space-y-2">
              {LOADING_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2.5 text-sm">
                  {i < loadingStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : i === loadingStep ? (
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                  )}
                  <span
                    className={cn(
                      'transition-colors',
                      i <= loadingStep ? 'text-foreground' : 'text-muted-foreground/40'
                    )}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results Summary Bar ── */}
      {results && !searchMutation.isPending && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-sm flex-1">{results.query_summary}</span>
            <Badge variant="secondary">{results.total} results</Badge>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-green-600">
              <Globe className="h-3.5 w-3.5" />
              <span><strong>{withWebsite}</strong> have websites</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              <span><strong>{withoutWebsite}</strong> have no website — opportunity!</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 text-yellow-600">
              <Star className="h-3.5 w-3.5" />
              <span><strong>{highRating}</strong> rated 4★ or higher</span>
            </div>
          </div>

          {/* Save all button */}
          {results.businesses.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAll}
                disabled={saveMutation.isPending}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Save all as leads
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {results && results.businesses.length === 0 && (
        <div className="text-center py-16 text-muted-foreground animate-fade-in">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No businesses found</p>
          <p className="text-xs mt-1">Try a different search or add a Google Places API key.</p>
        </div>
      )}

      {/* ── Results Grid ── */}
      {results && results.businesses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
          {results.businesses.map(biz => (
            <BusinessCard
              key={biz.id}
              business={biz}
              isSaved={savedLeads.has(biz.id)}
              onSave={() => saveMutation.mutate(biz.id)}
              isSaving={saveMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Business Card ─────────────────────────────────────────────────────────────

function BusinessCard({
  business,
  isSaved,
  onSave,
  isSaving,
}: {
  business: BusinessResult;
  isSaved: boolean;
  onSave: () => void;
  isSaving: boolean;
}) {
  const hasWebsite = !!business.website;
  const hasHighRating = (business.google_rating ?? 0) >= 4;

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all',
        !hasWebsite && 'border-orange-200 dark:border-orange-900'
      )}
    >
      <CardContent className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{business.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{business.industry}</p>
          </div>
          <Button
            size="sm"
            variant={isSaved ? 'secondary' : 'default'}
            className="h-7 text-xs shrink-0 gap-1"
            onClick={onSave}
            disabled={isSaved || isSaving}
            aria-label={isSaved ? `${business.name} saved as lead` : `Save ${business.name} as lead`}
          >
            {isSaved
              ? <><CheckCircle2 className="h-3 w-3 text-green-500" />Saved</>
              : isSaving
              ? <><Loader2 className="h-3 w-3 animate-spin" />Saving...</>
              : <><Plus className="h-3 w-3" />Save</>
            }
          </Button>
        </div>

        <Separator />

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {[business.city, business.country].filter(Boolean).join(', ')}
            </span>
          </div>

          {business.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
              <a href={`tel:${business.phone}`} className="hover:text-foreground">
                {business.phone}
              </a>
            </div>
          )}

          {hasWebsite ? (
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3 shrink-0 text-green-500" aria-hidden="true" />
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
                aria-label={`Visit ${business.name} website (opens in new tab)`}
              >
                {business.website!.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-500 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>No website — opportunity!</span>
            </div>
          )}

          {business.google_rating != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Star
                className={cn('h-3 w-3 shrink-0', hasHighRating ? 'text-yellow-400' : '')}
                aria-hidden="true"
              />
              <span>
                <span className={hasHighRating ? 'text-yellow-600 font-medium' : ''}>
                  {business.google_rating}★
                </span>
                {' '}({business.google_reviews_count ?? 0} reviews)
              </span>
            </div>
          )}
        </div>

        {/* Opportunity badge */}
        {!hasWebsite && (
          <Badge variant="warning" className="w-full justify-center text-xs">
            Website opportunity
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
