import { createAbortController } from './platform/abort';

export type TmdbMetadata = {
  overview: string;
  year: string;
  genres: string;
  cast: string;
  poster?: string;
  backdrop?: string;
  tmdbId: number;
};

type TmdbSearchItem = {
  id?: number;
  title?: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
};
type TmdbSearchResponse = { results?: TmdbSearchItem[] };
type TmdbListResponse = { results?: TmdbSearchItem[] };
type TmdbDetails = TmdbSearchItem & {
  genres?: Array<{ name?: string }>;
  credits?: { cast?: Array<{ name?: string }> };
};
const memory = new Map<string, TmdbMetadata | null>();
const TMDB_METADATA_CACHE_KEY = 'nextflix.tmdb-metadata-cache.v1';
const TMDB_METADATA_CACHE_LIMIT = 120;
const TMDB_METADATA_CACHE_AGE = 90 * 24 * 60 * 60 * 1000;
type CachedMetadata = { savedAt: number; value: TmdbMetadata | null };
let persistentCache: Record<string, CachedMetadata> | null = null;

export type TmdbHomePlaylist = 'featured-movies' | 'featured-series' | 'popular-movies' | 'top-rated-movies'
  | 'now-playing-movies' | 'upcoming-movies' | 'popular-series' | 'top-rated-series' | 'airing-today-series' | 'on-the-air-series';
export type TmdbHomeEntry = { id: number; title: string; year: string; poster?: string; backdrop?: string; overview: string };
export const TMDB_HOME_PLAYLISTS: Array<{ id: TmdbHomePlaylist; label: string; kind: 'movie' | 'series'; path: string }> = [
  { id: 'featured-movies', label: 'Featured Movies', kind: 'movie', path: 'trending/movie/week' },
  { id: 'featured-series', label: 'Featured Series', kind: 'series', path: 'trending/tv/week' },
  { id: 'popular-movies', label: 'Popular Movies', kind: 'movie', path: 'movie/popular' },
  { id: 'top-rated-movies', label: 'Top Rated Movies', kind: 'movie', path: 'movie/top_rated' },
  { id: 'now-playing-movies', label: 'Now Playing Movies', kind: 'movie', path: 'movie/now_playing' },
  { id: 'upcoming-movies', label: 'Upcoming Movies', kind: 'movie', path: 'movie/upcoming' },
  { id: 'popular-series', label: 'Popular Series', kind: 'series', path: 'tv/popular' },
  { id: 'top-rated-series', label: 'Top Rated Series', kind: 'series', path: 'tv/top_rated' },
  { id: 'airing-today-series', label: 'Airing Today', kind: 'series', path: 'tv/airing_today' },
  { id: 'on-the-air-series', label: 'On The Air', kind: 'series', path: 'tv/on_the_air' }
];

export function cleanTitle(raw: string): string {
  return raw.replace(/^\s*(?:[A-Z]{2,5}|NF|MULTI)\s*[-|:]\s*/i, '')
    .replace(/\s*\((?:\d{4}|MULTI SUB|[A-Z]{2,8} SUB)\).*$/i, '')
    .replace(/\s+\d{4}\s*$/, '').trim();
}

function comparable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function apiUrl(path: string, apiKey: string, params: Record<string, string> = {}): { url: string; headers: HeadersInit } {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const trimmed = apiKey.trim();
  // TMDB v3 API keys are sent as api_key. The account's v4 read token also works as a Bearer token.
  const headers: HeadersInit = { Accept: 'application/json' };
  if (/^eyJ[A-Za-z0-9_-]+\./.test(trimmed)) headers.Authorization = `Bearer ${trimmed}`;
  else url.searchParams.set('api_key', trimmed);
  return { url: url.toString(), headers };
}

async function getJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const controller = createAbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const payload = await response.json() as T & { status_message?: string; status_code?: number };
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(payload.status_message || 'TMDB rejected the API key. Check the key in Settings.');
      }
      throw new Error(payload.status_message || `TMDB returned HTTP ${response.status}.`);
    }
    return payload;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The TV browser could not reach TMDB. Check the network and browser access.');
    if (error instanceof Error && error.name === 'AbortError') throw new Error('TMDB did not respond in time.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

function itemTitle(item: TmdbSearchItem): string {
  return String(item.title ?? item.original_title ?? item.name ?? item.original_name ?? '').trim();
}
function itemYear(item: TmdbSearchItem): string {
  return String(item.release_date ?? item.first_air_date ?? '').match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '';
}
function imageUrl(path: string | null | undefined, size: 'w500' | 'w780'): string | undefined {
  return path && path.startsWith('/') ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

function loadPersistentCache(): Record<string, CachedMetadata> {
  if (persistentCache) return persistentCache;
  persistentCache = {};
  try {
    const saved = JSON.parse(localStorage.getItem(TMDB_METADATA_CACHE_KEY) ?? '{}') as Record<string, CachedMetadata>;
    const cutoff = Date.now() - TMDB_METADATA_CACHE_AGE;
    for (const [key, entry] of Object.entries(saved)) {
      if (entry && Number.isFinite(entry.savedAt) && entry.savedAt >= cutoff) persistentCache[key] = entry;
    }
  } catch { /* TMDB still works when local storage is unavailable. */ }
  return persistentCache;
}

function cacheMetadata(key: string, value: TmdbMetadata | null): void {
  memory.set(key, value);
  while (memory.size > TMDB_METADATA_CACHE_LIMIT) memory.delete(memory.keys().next().value!);
  const cache = loadPersistentCache();
  cache[key] = { savedAt: Date.now(), value };
  const oldestFirst = Object.entries(cache).sort((left, right) => left[1].savedAt - right[1].savedAt);
  while (oldestFirst.length > TMDB_METADATA_CACHE_LIMIT) delete cache[oldestFirst.shift()![0]];
  try { localStorage.setItem(TMDB_METADATA_CACHE_KEY, JSON.stringify(cache)); } catch { /* Keep the in-memory entry if storage is full. */ }
}

export function clearTmdbMetadataCache(): void {
  memory.clear();
  persistentCache = {};
  try { localStorage.removeItem(TMDB_METADATA_CACHE_KEY); } catch { /* Storage cleanup is best-effort. */ }
}

export function normalizeTmdbTitle(value: string): string {
  return comparable(cleanTitle(value));
}

export async function fetchTmdbHomePlaylist(playlist: TmdbHomePlaylist, apiKey: string): Promise<TmdbHomeEntry[]> {
  const config = TMDB_HOME_PLAYLISTS.find((item) => item.id === playlist);
  if (!config || !apiKey.trim()) return [];
  const request = apiUrl(config.path, apiKey, { language: 'en-US', page: '1' });
  const response = await getJson<TmdbListResponse>(request.url, request.headers);
  const entries: TmdbHomeEntry[] = [];
  for (const item of (response.results ?? []).slice(0, 20)) {
    if (!item.id) continue;
    const title = itemTitle(item);
    if (!title) continue;
    entries.push({
      id: item.id,
      title,
      year: itemYear(item),
      poster: imageUrl(item.poster_path, 'w500'),
      backdrop: imageUrl(item.backdrop_path, 'w780'),
      overview: String(item.overview ?? '').trim()
    });
  }
  return entries;
}

export async function findTmdbMetadata(kind: 'movie' | 'series', rawTitle: string, rawYear: string, apiKey: string): Promise<TmdbMetadata | null> {
  const title = cleanTitle(rawTitle);
  const year = rawYear.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? rawTitle.match(/\((\d{4})\)/)?.[1] ?? '';
  if (!apiKey.trim() || title.length < 2) return null;
  const cacheKey = `${kind}:${comparable(title)}:${year}`;
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;
  const cached = loadPersistentCache()[cacheKey];
  if (cached) {
    memory.set(cacheKey, cached.value);
    return cached.value;
  }

  const searchPath = kind === 'movie' ? 'search/movie' : 'search/tv';
  const searchParams: Record<string, string> = { query: title, include_adult: 'false', language: 'en-US' };
  if (year) searchParams[kind === 'movie' ? 'year' : 'first_air_date_year'] = year;
  const searchRequest = apiUrl(searchPath, apiKey, searchParams);
  const search = await getJson<TmdbSearchResponse>(searchRequest.url, searchRequest.headers);
  const wanted = comparable(title);
  const candidates = (search.results ?? []).filter((item) => {
    const names = [item.title, item.original_title, item.name, item.original_name].filter((value): value is string => !!value);
    return names.some((value) => comparable(value) === wanted)
      && (!year || !itemYear(item) || Math.abs(Number(itemYear(item)) - Number(year)) <= 1);
  }).sort((a, b) => Number(!!b.overview) - Number(!!a.overview));
  const match = candidates[0];
  if (!match?.id) { cacheMetadata(cacheKey, null); return null; }

  const detailsRequest = apiUrl(`${kind === 'movie' ? 'movie' : 'tv'}/${match.id}`, apiKey,
    { language: 'en-US', append_to_response: 'credits' });
  const details = await getJson<TmdbDetails>(detailsRequest.url, detailsRequest.headers);
  const metadata: TmdbMetadata = {
    overview: String(details.overview ?? match.overview ?? '').trim(),
    year: itemYear(details) || itemYear(match),
    genres: (details.genres ?? []).map((genre) => genre.name?.trim()).filter((name): name is string => !!name).slice(0, 3).join(', '),
    cast: (details.credits?.cast ?? []).map((person) => person.name?.trim()).filter((name): name is string => !!name).slice(0, 5).join(', '),
    poster: imageUrl(details.poster_path ?? match.poster_path, 'w500'),
    backdrop: imageUrl(details.backdrop_path ?? match.backdrop_path, 'w780'),
    tmdbId: details.id ?? match.id
  };
  cacheMetadata(cacheKey, metadata);
  return metadata;
}
