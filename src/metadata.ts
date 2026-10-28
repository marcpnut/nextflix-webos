export type OmdbMetadata = {
  overview: string;
  year: string;
  genres: string;
  cast: string;
  poster?: string;
  imdbId?: string;
};

type OmdbResponse = {
  Response?: string;
  Error?: string;
  Title?: string;
  Year?: string;
  Genre?: string;
  Actors?: string;
  Plot?: string;
  Poster?: string;
  imdbID?: string;
  Type?: string;
};

const memory = new Map<string, OmdbMetadata | null>();

export function cleanTitle(raw: string): string {
  return raw.replace(/^\s*(?:[A-Z]{2,5}|NF|MULTI)\s*[-|:]\s*/i, '')
    .replace(/\s*\((?:\d{4}|MULTI SUB|[A-Z]{2,8} SUB)\).*$/i, '')
    .replace(/\s+\d{4}\s*$/, '').trim();
}

function comparable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function getJson(url: string): Promise<OmdbResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('OMDb rejected the API key. Check that it was copied correctly and that the key has been activated by email.');
      }
      throw new Error(`OMDb returned HTTP ${response.status}.`);
    }
    return await response.json() as OmdbResponse;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The TV browser could not reach OMDb. Check the network and browser access.');
    if (error instanceof Error && error.name === 'AbortError') throw new Error('OMDb did not respond in time.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export async function findOmdbMetadata(kind: 'movie' | 'series', rawTitle: string, rawYear: string, apiKey: string): Promise<OmdbMetadata | null> {
  const title = cleanTitle(rawTitle);
  const year = rawYear.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? rawTitle.match(/\((\d{4})\)/)?.[1] ?? '';
  if (!apiKey.trim() || title.length < 2) return null;
  const cacheKey = `${kind}:${comparable(title)}:${year}`;
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', apiKey.trim());
  url.searchParams.set('t', title);
  url.searchParams.set('type', kind);
  url.searchParams.set('plot', 'full');
  if (year) url.searchParams.set('y', year);
  const response = await getJson(url.toString());
  if (response.Response !== 'True') {
    const error = response.Error ?? 'No matching title was found.';
    if (/request limit|invalid api key|authentication/i.test(error)) throw new Error(`OMDb: ${error}`);
    memory.set(cacheKey, null);
    return null;
  }

  const returnedTitle = String(response.Title ?? '').trim();
  const returnedYear = String(response.Year ?? '').match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '';
  if (!returnedTitle || comparable(returnedTitle) !== comparable(title)
    || (year && returnedYear && Math.abs(Number(returnedYear) - Number(year)) > 1)) {
    memory.set(cacheKey, null);
    return null;
  }
  const poster = typeof response.Poster === 'string' && /^https:\/\//i.test(response.Poster) && response.Poster !== 'N/A'
    ? response.Poster : undefined;
  const metadata: OmdbMetadata = {
    overview: String(response.Plot ?? '').trim(),
    year: returnedYear,
    genres: String(response.Genre ?? '').split(',').slice(0, 3).map((part) => part.trim()).filter(Boolean).join(', '),
    cast: String(response.Actors ?? '').split(',').slice(0, 5).map((part) => part.trim()).filter(Boolean).join(', '),
    poster,
    imdbId: typeof response.imdbID === 'string' ? response.imdbID : undefined
  };
  memory.set(cacheKey, metadata);
  if (memory.size > 80) memory.delete(memory.keys().next().value!);
  return metadata;
}
