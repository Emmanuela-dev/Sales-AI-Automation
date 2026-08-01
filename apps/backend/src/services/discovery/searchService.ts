import { supabaseAdmin } from '../../lib/supabase';
import { env } from '../../config/env';
import axios from 'axios';
import type { BusinessSearchParams, BusinessSearchResult, Business } from '@prospectai/shared';

/** A business discovered from a provider, before it has a database identity. */
type BusinessCandidate = Omit<Business, 'id' | 'created_at' | 'updated_at'>;

/**
 * Main business search service.
 * Uses Google Places API when available, falls back to internal DB.
 *
 * Every returned business carries its real database id, so the caller can
 * immediately save it as a lead without hitting a foreign-key violation.
 */
export async function searchBusinesses(params: BusinessSearchParams): Promise<BusinessSearchResult> {
  const limit = params.limit ?? 20;

  let businesses: Business[];

  if (env.GOOGLE_PLACES_API_KEY) {
    const candidates = await searchGooglePlaces(buildQuery(params), params);
    businesses = await persistBusinesses(candidates);
  } else {
    // No Places key — search what we already have rather than returning nothing.
    businesses = await searchDatabase(params);
  }

  return {
    businesses: businesses.slice(0, limit),
    total: businesses.length,
    query_summary: buildSummary(businesses, params),
  };
}

function buildQuery(params: BusinessSearchParams): string {
  const parts = [params.query];
  if (params.city) parts.push(params.city);
  if (params.country) parts.push(params.country);
  return parts.join(' ');
}

async function searchGooglePlaces(
  query: string,
  params: BusinessSearchParams
): Promise<BusinessCandidate[]> {
  const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
    params: { query, key: env.GOOGLE_PLACES_API_KEY, language: 'en' },
    timeout: 15000,
  });

  // Places returns HTTP 200 even for auth and quota failures — the real outcome
  // is in `status`. Without this check a bad key looks like "no results found".
  const status = response.data?.status;
  if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
    const detail = response.data?.error_message ?? 'no further detail provided';
    throw new Error(`Google Places API returned ${status}: ${detail}`);
  }

  const results: GooglePlace[] = response.data?.results ?? [];
  const wanted = results.slice(0, params.limit ?? 20);

  // Each result needs a second call for website/phone. Run them with bounded
  // concurrency so a 20-result search doesn't take 20 sequential round trips.
  const details = await mapWithConcurrency(wanted, 5, (place) => fetchPlaceDetails(place.place_id));

  return wanted.map((place, i) => ({
    name: place.name,
    industry: params.industry ?? inferIndustry(place.types ?? []),
    country: params.country ?? '',
    city: params.city ?? extractCity(place.formatted_address ?? ''),
    address: place.formatted_address,
    phone: details[i]?.formatted_phone_number,
    email: undefined,
    website: details[i]?.website,
    google_rating: place.rating,
    google_reviews_count: place.user_ratings_total,
    source: 'google_places' as const,
  }));
}

interface GooglePlace {
  place_id: string;
  name: string;
  types?: string[];
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
}

interface PlaceDetails {
  website?: string;
  formatted_phone_number?: string;
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'website,formatted_phone_number',
        key: env.GOOGLE_PLACES_API_KEY,
      },
      timeout: 15000,
    });
    return response.data?.result ?? null;
  } catch {
    // Details are enrichment only — a failure here shouldn't lose the business.
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function work() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, work));
  return results;
}

async function searchDatabase(params: BusinessSearchParams): Promise<Business[]> {
  let builder = supabaseAdmin
    .from('businesses')
    .select('*')
    .ilike('name', `%${params.query}%`);

  if (params.city) builder = builder.ilike('city', `%${params.city}%`);
  if (params.country) builder = builder.eq('country', params.country);
  if (params.industry) builder = builder.eq('industry', params.industry);

  // range() is inclusive on both ends, so the upper bound is offset+limit-1.
  // Previously limit() and range() were combined and returned limit+1 rows.
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  builder = builder.range(offset, offset + limit - 1);

  const { data, error } = await builder;
  if (error) throw new Error(`Business search failed: ${error.message}`);
  return (data as Business[]) ?? [];
}

/**
 * Persists discovered businesses and returns the stored rows.
 *
 * Deduplication is case-insensitive on (name, city), matching the
 * `businesses_name_city_idx` unique index. That index is an expression index on
 * LOWER(name)/LOWER(city), which PostgREST's `on_conflict` cannot target — so
 * existing rows are resolved with an explicit lookup instead of an upsert.
 */
async function persistBusinesses(candidates: BusinessCandidate[]): Promise<Business[]> {
  if (candidates.length === 0) return [];

  // Collapse duplicates inside this result set first.
  const unique = new Map<string, BusinessCandidate>();
  for (const candidate of candidates) {
    unique.set(dedupeKey(candidate.name, candidate.city), candidate);
  }

  const existing = await findExisting([...unique.values()]);
  const stored: Business[] = [];
  const toInsert: BusinessCandidate[] = [];

  for (const [key, candidate] of unique) {
    const match = existing.get(key);
    if (match) {
      stored.push(await enrichExisting(match, candidate));
    } else {
      toInsert.push(candidate);
    }
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabaseAdmin.from('businesses').insert(toInsert).select();

    if (error) {
      // A concurrent search may have inserted the same business between our
      // lookup and this insert. Re-resolve rather than failing the search.
      const reResolved = await findExisting(toInsert);
      for (const candidate of toInsert) {
        const match = reResolved.get(dedupeKey(candidate.name, candidate.city));
        if (match) stored.push(match);
      }
      if (stored.length === 0) {
        throw new Error(`Failed to save discovered businesses: ${error.message}`);
      }
    } else {
      stored.push(...((data as Business[]) ?? []));
    }
  }

  return stored;
}

/** Looks up already-stored rows for the given candidates, keyed for dedupe. */
async function findExisting(candidates: BusinessCandidate[]): Promise<Map<string, Business>> {
  const names = [...new Set(candidates.map((c) => c.name))];
  if (names.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .in('name', names);

  if (error) throw new Error(`Business lookup failed: ${error.message}`);

  const map = new Map<string, Business>();
  for (const row of (data as Business[]) ?? []) {
    map.set(dedupeKey(row.name, row.city), row);
  }
  return map;
}

/**
 * Fills in fields the stored row is missing (a website discovered on a later
 * search, a phone number that wasn't there before) without overwriting data
 * that has since been edited by hand.
 */
async function enrichExisting(stored: Business, candidate: BusinessCandidate): Promise<Business> {
  const patch: Partial<Business> = {};

  if (!stored.website && candidate.website) patch.website = candidate.website;
  if (!stored.phone && candidate.phone) patch.phone = candidate.phone;
  if (!stored.address && candidate.address) patch.address = candidate.address;
  if (candidate.google_rating != null && candidate.google_rating !== stored.google_rating) {
    patch.google_rating = candidate.google_rating;
  }
  if (
    candidate.google_reviews_count != null &&
    candidate.google_reviews_count !== stored.google_reviews_count
  ) {
    patch.google_reviews_count = candidate.google_reviews_count;
  }

  if (Object.keys(patch).length === 0) return stored;

  const { data } = await supabaseAdmin
    .from('businesses')
    .update(patch)
    .eq('id', stored.id)
    .select()
    .single();

  return (data as Business) ?? { ...stored, ...patch };
}

function dedupeKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${(city ?? '').trim().toLowerCase()}`;
}

function buildSummary(businesses: Business[], params: BusinessSearchParams): string {
  const withWebsite = businesses.filter((b) => b.website).length;
  const withPhone = businesses.filter((b) => b.phone).length;
  return `Found ${businesses.length} businesses matching "${params.query}"${
    params.city ? ` in ${params.city}` : ''
  }. ${withWebsite} have websites, ${withPhone} have phone numbers.`;
}

function inferIndustry(types: string[]): string {
  const map: Record<string, string> = {
    lodging: 'Hospitality',
    restaurant: 'Restaurant & Food',
    food: 'Restaurant & Food',
    hospital: 'Healthcare',
    doctor: 'Healthcare',
    lawyer: 'Legal',
    school: 'Education',
    real_estate_agency: 'Real Estate',
    bank: 'Finance & Banking',
    store: 'Retail',
    car_dealer: 'Automotive',
    beauty_salon: 'Beauty & Wellness',
  };
  for (const type of types) {
    if (map[type]) return map[type];
  }
  return 'Other';
}

function extractCity(address: string): string {
  const parts = address.split(',');
  return parts.length >= 2 ? parts[parts.length - 2].trim() : '';
}
