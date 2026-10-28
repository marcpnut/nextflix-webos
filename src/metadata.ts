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
type TmdbDetails = TmdbSearchItem & {
  genres?: Array<{ name?: string }>;
  credits?: { cast?: Array<{ name?: string }> };
};
const memory = new Map<string, TmdbMetadata | null>();

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
  const controller = new AbortController();
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

export async function findTmdbMetadata(kind: 'movie' | 'series', rawTitle: string, rawYear: string, apiKey: string): Promise<TmdbMetadata | null> {
  const title = cleanTitle(rawTitle);
  const year = rawYear.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? rawTitle.match(/\((\d{4})\)/)?.[1] ?? '';
  if (!apiKey.trim() || title.length < 2) return null;
  const cacheKey = `${kind}:${comparable(title)}:${year}`;
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;

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
  if (!match?.id) { memory.set(cacheKey, null); return null; }

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
  memory.set(cacheKey, metadata);
  if (memory.size > 80) memory.delete(memory.keys().next().value!);
  return metadata;
}