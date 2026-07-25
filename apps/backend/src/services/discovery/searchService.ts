import { supabaseAdmin } from '../../lib/supabase';
import { env } from '../../config/env';
import axios from 'axios';
import type { BusinessSearchParams, BusinessSearchResult, Business } from '@prospectai/shared';

/**
 * Main business search service.
 * Uses Google Places API when available, falls back to internal DB.
 */
export async function searchBusinesses(params: BusinessSearchParams): Promise<BusinessSearchResult> {
  const query = buildQuery(params);

  let businesses: Business[] = [];

  if (env.GOOGLE_PLACES_API_KEY) {
    businesses = await searchGooglePlaces(query, params);
  } else {
    // Fallback: search existing database
    businesses = await searchDatabase(params);
  }

  // Upsert discovered businesses into DB
  if (businesses.length > 0) {
    await upsertBusinesses(businesses);
  }

  const summary = buildSummary(businesses, params);

  return {
    businesses,
    total: businesses.length,
    query_summary: summary,
  };
}

function buildQuery(params: BusinessSearchParams): string {
  const parts = [params.query];
  if (params.city) parts.push(params.city);
  if (params.country) parts.push(params.country);
  return parts.join(' ');
}

async function searchGooglePlaces(query: string, params: BusinessSearchParams): Promise<Business[]> {
  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

  const response = await axios.get(url, {
    params: {
      query,
      key: env.GOOGLE_PLACES_API_KEY,
      language: 'en',
    },
  });

  const results = response.data.results ?? [];
  const businesses: Business[] = [];

  for (const place of results.slice(0, params.limit ?? 20)) {
    // Fetch place details for richer data
    const details = await fetchPlaceDetails(place.place_id);

    businesses.push({
      id: crypto.randomUUID(),
      name: place.name,
      industry: params.industry ?? inferIndustry(place.types ?? []),
      country: params.country ?? '',
      city: params.city ?? extractCity(place.formatted_address ?? ''),
      address: place.formatted_address,
      phone: details?.formatted_phone_number,
      email: undefined,
      website: details?.website,
      google_rating: place.rating,
      google_reviews_count: place.user_ratings_total,
      source: 'google_places',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return businesses;
}

async function fetchPlaceDetails(placeId: string): Promise<{ website?: string; formatted_phone_number?: string } | null> {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'website,formatted_phone_number',
        key: env.GOOGLE_PLACES_API_KEY,
      },
    });
    return response.data.result ?? null;
  } catch {
    return null;
  }
}

async function searchDatabase(params: BusinessSearchParams): Promise<Business[]> {
  let builder = supabaseAdmin
    .from('businesses')
    .select('*')
    .ilike('name', `%${params.query}%`);

  if (params.city) builder = builder.ilike('city', `%${params.city}%`);
  if (params.country) builder = builder.eq('country', params.country);
  if (params.industry) builder = builder.eq('industry', params.industry);
  builder = builder.limit(params.limit ?? 20).range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 20));

  const { data } = await builder;
  return (data as Business[]) ?? [];
}

async function upsertBusinesses(businesses: Business[]): Promise<void> {
  await supabaseAdmin
    .from('businesses')
    .upsert(businesses, { onConflict: 'name,city', ignoreDuplicates: true });
}

function buildSummary(businesses: Business[], params: BusinessSearchParams): string {
  const withWebsite = businesses.filter(b => b.website).length;
  const withPhone = businesses.filter(b => b.phone).length;
  return `Found ${businesses.length} businesses matching "${params.query}"${params.city ? ` in ${params.city}` : ''}. ${withWebsite} have websites, ${withPhone} have phone numbers.`;
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
