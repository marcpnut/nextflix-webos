export type EpgChannel = { id: string; name: string; icon?: string };
export type EpgProgram = {
  channelId: string;
  start: number;
  end: number;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
};
export type EpgSnapshot = {
  key: string;
  savedAt: number;
  channels: EpgChannel[];
  programs: EpgProgram[];
};

export const EPG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const EPG_REFRESH_MS = 12 * 60 * 60 * 1000;
export const EPG_MAX_XML_BYTES = 16 * 1024 * 1024;
export const EPG_MAX_PROGRAMS = 80_000;

function xmltvTimestamp(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00', sign, offsetHour, offsetMinute] = match;
  const base = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (!sign) {
    const local = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    const timestamp = local.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === '+' ? 1 : -1);
  return base - offset * 60_000;
}

function textOf(node: Element, tag: string): string | undefined {
  const text = node.getElementsByTagName(tag)[0]?.textContent?.trim();
  return text || undefined;
}

export function parseXmltv(xml: string, now = Date.now()): { channels: EpgChannel[]; programs: EpgProgram[] } {
  if (!xml.trim() || xml.length > EPG_MAX_XML_BYTES) throw new Error('The XMLTV file is empty or larger than the 16 MB guide limit.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('The XMLTV file is malformed.');
  const channels: EpgChannel[] = [];
  const channelNodes = document.getElementsByTagName('channel');
  for (let index = 0; index < channelNodes.length && index < 10_000; index += 1) {
    const node = channelNodes[index];
    const id = node.getAttribute('id')?.trim();
    if (!id) continue;
    const displayName = textOf(node, 'display-name') ?? id;
    const icon = node.getElementsByTagName('icon')[0]?.getAttribute('src') ?? undefined;
    channels.push({ id, name: displayName, icon });
  }

  const from = now - EPG_RETENTION_MS;
  const to = now + EPG_RETENTION_MS;
  const programs: EpgProgram[] = [];
  const programNodes = document.getElementsByTagName('programme');
  for (let index = 0; index < programNodes.length && programs.length < EPG_MAX_PROGRAMS; index += 1) {
    const node = programNodes[index];
    const channelId = node.getAttribute('channel')?.trim();
    const start = xmltvTimestamp(node.getAttribute('start') ?? '');
    const end = xmltvTimestamp(node.getAttribute('stop') ?? '');
    if (!channelId || start === null || end === null || end <= start || end < from || start > to) continue;
    const title = textOf(node, 'title');
    if (!title) continue;
    programs.push({
      channelId,
      start,
      end,
      title,
      subtitle: textOf(node, 'sub-title'),
      description: textOf(node, 'desc'),
      category: textOf(node, 'category')
    });
  }
  programs.sort((left, right) => left.start - right.start);
  return { channels, programs };
}

function decodeProviderText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const binary = atob(value);
    const encoded = Array.from(binary, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(encoded);
  } catch {
    return value;
  }
}

function providerTimestamp(value: unknown): number | null {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{9,13}$/.test(value))) {
    const number = Number(value);
    return number < 10_000_000_000 ? number * 1000 : number;
  }
  if (typeof value === 'string') {
    const timestamp = Date.parse(value.replace(' ', 'T'));
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return null;
}

export function parseProviderEpg(streamId: string | number, response: unknown): EpgProgram[] {
  if (!response || typeof response !== 'object') return [];
  const listings = (response as { epg_listings?: unknown }).epg_listings;
  if (!Array.isArray(listings)) return [];
  const programs: EpgProgram[] = [];
  for (const entry of listings) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const start = providerTimestamp(item.start_timestamp ?? item.start);
    const end = providerTimestamp(item.stop_timestamp ?? item.end_timestamp ?? item.stop ?? item.end);
    const title = decodeProviderText(item.title) ?? (typeof item.title === 'string' ? item.title : '');
    if (start === null || end === null || end <= start || !title) continue;
    programs.push({
      channelId: String(streamId),
      start,
      end,
      title,
      description: decodeProviderText(item.description)
    });
  }
  return programs.sort((left, right) => left.start - right.start);
}

function normalizedName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findAutomaticEpgChannel(channel: { name?: string; epg_channel_id?: string }, epgChannels: EpgChannel[]): string | undefined {
  const explicit = channel.epg_channel_id?.trim();
  if (explicit && epgChannels.some((entry) => entry.id === explicit)) return explicit;
  const name = normalizedName(channel.name ?? '');
  if (!name) return undefined;
  const exact = epgChannels.find((entry) => normalizedName(entry.name) === name);
  return exact?.id;
}

export function providerCatchupUrl(
  base: string,
  username: string,
  password: string,
  streamId: string | number,
  start: number,
  durationMinutes: number,
  extension: string
): string {
  const date = new Date(start);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const startParam = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}:${pad(date.getHours())}-${pad(date.getMinutes())}`;
  const safeExtension = /^[a-z0-9]{1,8}$/i.test(extension) ? extension : 'ts';
  const segments = [username, password, String(Math.max(1, Math.floor(durationMinutes))), startParam, `${streamId}.${safeExtension}`]
    .map((segment) => encodeURIComponent(segment));
  return `${base.replace(/\/+$/, '')}/timeshift/${segments.join('/')}`;
}

