import { cleanTitle } from './metadata';

export type OnlineSubtitle = { fileId: number; language: string; release: string; downloadCount: number };

async function request(url: string, key: string, body?: object): Promise<any> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Api-Key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (response.status === 429) throw new Error('OpenSubtitles rate limit reached. Try again later.');
    if (response.status === 401 || response.status === 403) throw new Error('OpenSubtitles rejected the API key or browser request. Check the key in Settings.');
    if (!response.ok) throw new Error(`OpenSubtitles returned HTTP ${response.status}.`);
    return response.json();
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The TV browser could not reach OpenSubtitles. Its CORS policy may block direct app requests.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export async function searchOnlineSubtitles(key: string, title: string, languages: string[], season?: string, episode?: string): Promise<OnlineSubtitle[]> {
  if (!key.trim()) throw new Error('Add your OpenSubtitles.com API key in Settings first.');
  const params = new URLSearchParams();
  const values: Record<string, string> = {
    languages: languages.map((value) => value.toLowerCase().split('-')[0]).filter(Boolean).join(','),
    query: cleanTitle(title).toLowerCase(),
    ...(season ? { season_number: String(Number(season)) } : {}),
    ...(episode ? { episode_number: String(Number(episode)) } : {})
  };
  Object.keys(values).sort().forEach((name) => { if (values[name]) params.set(name, values[name]); });
  const result = await request(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, key);
  const data = Array.isArray(result.data) ? result.data : [];
  return data.slice(0, 20).map((item: any) => ({
    fileId: Number(item.attributes?.files?.[0]?.file_id),
    language: String(item.attributes?.language ?? ''),
    release: String(item.attributes?.release ?? ''),
    downloadCount: Number(item.attributes?.download_count ?? 0)
  })).filter((item: OnlineSubtitle) => Number.isInteger(item.fileId) && item.fileId > 0 && item.language);
}

export async function downloadOnlineSubtitle(key: string, fileId: number): Promise<string> {
  const result = await request('https://api.opensubtitles.com/api/v1/download', key, { file_id: fileId, sub_format: 'srt' });
  const url = String(result.link ?? '');
  if (!url.startsWith('https://')) throw new Error('OpenSubtitles did not return a secure download link.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Subtitle download failed (HTTP ${response.status}).`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 1024 * 1024) throw new Error('Subtitle file is larger than 1 MB.');
    const text = await response.text();
    if (text.length > 1024 * 1024) throw new Error('Subtitle file is larger than 1 MB.');
    return srtToVtt(text);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The subtitle download was blocked by the TV browser or the provider CORS policy.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export function srtToVtt(source: string): string {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT\b/.test(normalized)) return `${normalized}\n`;
  const cues = normalized.replace(/^\d+\s*\n(?=\d\d:\d\d:\d\d[,\.])/gm, '')
    .replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2');
  if (!/\d\d:\d\d:\d\d\.\d{3}\s*-->/.test(cues)) throw new Error('The subtitle file is not valid SRT or WebVTT.');
  return `WEBVTT\n\n${cues}\n`;
}
