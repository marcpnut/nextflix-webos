export type TmdbMetadata = {
  overview: string;
  year: string;
  genres: string;
  cast: string;
  poster?: string;
  backdrop?: string;
  imdbId?: string;
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

async function getJson(url: string, token: string): Promise<any> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}.`);
    return response.json();
  } finally { window.clearTimeout(timeout); }
}

export async function findTmdbMetadata(kind: 'movie' | 'series', rawTitle: string, rawYear: string, token: string): Promise<TmdbMetadata | null> {
  const title = cleanTitle(rawTitle);
  const year = rawYear.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? rawTitle.match(/\((\d{4})\)/)?.[1] ?? '';
  if (!token.trim() || title.length < 2) return null;
  const cacheKey = `${kind}:${comparable(title)}:${year}`;
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;
  const section = kind === 'movie' ? 'movie' : 'tv';
  const searchUrl = new URL(`https://api.themoviedb.org/3/search/${section}`);
  searchUrl.searchParams.set('query', title);
  searchUrl.searchParams.set('language', 'en-US');
  searchUrl.searchParams.set('include_adult', 'false');
  const search = await getJson(searchUrl.toString(), token);
  const matches = (Array.isArray(search.results) ? search.results : []).filter((entry: any) => {
    const candidate = entry.title ?? entry.name ?? '';
    const original = entry.original_title ?? entry.original_name ?? '';
    const candidateYear = String(entry.release_date ?? entry.first_air_date ?? '').slice(0, 4);
    return (comparable(candidate) === comparable(title) || comparable(original) === comparable(title))
      && (!year || !candidateYear || Math.abs(Number(candidateYear) - Number(year)) <= 1);
  });
  if (matches.length !== 1 || !Number.isInteger(matches[0].id)) {
    memory.set(cacheKey, null);
    return null;
  }
  const details = await getJson(`https://api.themoviedb.org/3/${section}/${matches[0].id}?language=en-US&append_to_response=credits,external_ids`, token);
  const result: TmdbMetadata = {
    overview: String(details.overview ?? matches[0].overview ?? '').trim(),
    year: String(details.release_date ?? details.first_air_date ?? '').slice(0, 4),
    genres: (Array.isArray(details.genres) ? details.genres : []).slice(0, 3).map((genre: any) => String(genre.name ?? '')).filter(Boolean).join(', '),
    cast: (Array.isArray(details.credits?.cast) ? details.credits.cast : []).slice(0, 5).map((person: any) => String(person.name ?? '')).filter(Boolean).join(', '),
    poster: typeof details.poster_path === 'string' ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : undefined,
    backdrop: typeof details.backdrop_path === 'string' ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : undefined,
    imdbId: typeof details.imdb_id === 'string' ? details.imdb_id : typeof details.external_ids?.imdb_id === 'string' ? details.external_ids.imdb_id : undefined
  };
  memory.set(cacheKey, result);
  if (memory.size > 80) memory.delete(memory.keys().next().value!);
  return result;
}
