import './style.css';
import { readCatalog, writeCatalog, type CachedCatalog, type CatalogCategory as Category, type CatalogChannel as Channel } from './catalogCache';

type XtreamAuth = {
  user_info?: { auth?: number; status?: string; exp_date?: string | null; allowed_output_formats?: string[] };
  server_info?: { url?: string; port?: string | number; https_port?: string | number; server_protocol?: string };
};

type LiveFormat = 'auto' | 'ts' | 'm3u8';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing app element: ${id}`);
  return element as T;
};

const form = $('connect-form') as HTMLFormElement;
const serverInput = $('server') as HTMLInputElement;
const usernameInput = $('username') as HTMLInputElement;
const passwordInput = $('password') as HTMLInputElement;
const rememberProviderInput = $('remember-provider') as HTMLInputElement;
const formatInput = $('format') as HTMLSelectElement;
const connectButton = $('connect-button') as HTMLButtonElement;
const saveProviderButton = $('save-provider-button') as HTMLButtonElement;
const message = $('message');
const stateLabel = $('connection-state');
const setupSection = $('setup');
const librarySection = $('library');
const categorySelect = $('category') as HTMLSelectElement;
const channelList = $('channel-list');
const moreButton = $('more-button') as HTMLButtonElement;
const libraryMessage = $('library-message');
const playerLayer = $('player');
const video = $('video') as HTMLVideoElement;
const playerMessage = $('player-message');
const playingTitle = $('playing-title');
const playPauseButton = $('play-pause') as HTMLButtonElement;

const PAGE_SIZE = 72;
const CATALOG_REFRESH_MS = 24 * 60 * 60 * 1000;
const REMEMBERED_PROVIDER_KEY = 'nextflix.xtream.provider.v1';
const APP_VERSION = '0.1.9';
const versionLabel = $('app-version');
versionLabel.textContent = `NextFlix ${APP_VERSION}`;
type SavedProvider = { base: string; username: string; password: string; format: LiveFormat };
let credentials: { base: string; username: string; password: string } | null = null;
let playbackBase: string | null = null;
let allowedLiveFormats: string[] = [];
let activeLiveFormat: string | null = null;
let categories: Category[] = [];
let channels: Channel[] = [];
let visibleChannels: Channel[] = [];
let renderedCount = 0;
let selectedChannel: Channel | null = null;
let requestController: AbortController | null = null;

function setMessage(text: string, isError = false): void {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function setProgress(text: string): void {
  setMessage(text);
  stateLabel.textContent = text;
  if (!librarySection.classList.contains('hidden')) {
    libraryMessage.textContent = text;
    libraryMessage.classList.remove('hidden', 'error');
    libraryMessage.classList.add('loading');
  }
}

function setBusy(busy: boolean): void {
  connectButton.disabled = busy;
  connectButton.textContent = busy ? 'Connecting… Please wait' : 'Connect and load channels';
  form.setAttribute('aria-busy', String(busy));
  message.classList.toggle('loading', busy);
  connectButton.classList.toggle('connecting', busy);
  stateLabel.classList.toggle('loading', busy);
}

function readSavedProvider(): SavedProvider | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_PROVIDER_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedProvider>;
    if (typeof saved.base !== 'string' || typeof saved.username !== 'string' || typeof saved.password !== 'string') return null;
    return {
      base: saved.base,
      username: saved.username,
      password: saved.password,
      format: saved.format === 'm3u8' || saved.format === 'auto' ? saved.format : 'ts'
    };
  } catch {
    return null;
  }
}

function saveProvider(saved: SavedProvider): boolean {
  try {
    const serialized = JSON.stringify(saved);
    localStorage.setItem(REMEMBERED_PROVIDER_KEY, serialized);
    return localStorage.getItem(REMEMBERED_PROVIDER_KEY) === serialized;
  } catch {
    return false;
  }
}

function saveCurrentProvider(): boolean {
  try {
    const base = normalizedBase(serverInput.value);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) throw new Error('Enter the URL, username, and password before saving.');
    const saved = { base, username, password, format: formatInput.value as LiveFormat };
    if (!saveProvider(saved)) throw new Error('TV storage did not confirm the saved login.');
    rememberProviderInput.checked = true;
    setMessage('Login saved on this TV.');
    return true;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Could not save the login.', true);
    return false;
  }
}

function forgetProvider(): void {
  try { localStorage.removeItem(REMEMBERED_PROVIDER_KEY); } catch { /* Storage may be unavailable on some TV builds. */ }
}

function normalizedBase(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Enter an http or https server URL.');
  return parsed.toString().replace(/\/+$/, '');
}

async function api<T>(action?: string, extra: Record<string, string> = {}, timeoutMs = 60_000): Promise<T> {
  if (!credentials) throw new Error('Connect to a provider first.');
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const query = new URLSearchParams({ username: credentials.username, password: credentials.password, ...extra });
  if (action) query.set('action', action);
  try {
    const response = await fetch(`${credentials.base}/player_api.php?${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object') throw new Error('Provider returned an unexpected response.');
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Provider returned')) throw error;
    if (controller.signal.aborted) throw new Error('The provider request timed out.');
    throw new Error('Could not reach the provider. Check the URL, network, TLS, and browser CORS support.');
  } finally {
    window.clearTimeout(timeout);
    if (requestController === controller) requestController = null;
  }
}

function assertAuthenticated(data: XtreamAuth): void {
  if (!data.user_info) throw new Error('Provider did not return account information. Check the server URL.');
  if (Number(data.user_info.auth) !== 1 || data.user_info.status?.toLowerCase() === 'disabled') {
    throw new Error('The provider rejected this account or it is disabled.');
  }
}

function catalogKey(base: string, username: string): string {
  // Keep credentials out of the cache key. A cache is only a rebuildable catalog snapshot.
  return `${new URL(base).origin}${new URL(base).pathname}|${username}`;
}

function providerPlaybackServer(auth: XtreamAuth, enteredBase: string): string {
  const server = auth.server_info;
  if (!server?.url) return enteredBase;
  try {
    const protocol = server.server_protocol === 'https' ? 'https:' : server.server_protocol === 'http' ? 'http:' : new URL(enteredBase).protocol;
    const rawHost = server.url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const endpoint = new URL(`${protocol}//${rawHost}`);
    const suppliedPort = String(server.port ?? new URL(enteredBase).port).trim();
    if (!endpoint.port && suppliedPort) endpoint.port = suppliedPort.replace(/^:/, '');
    return endpoint.toString().replace(/\/$/, '');
  } catch {
    return enteredBase;
  }
}

function normalizedFormats(formats: unknown): string[] {
  if (!Array.isArray(formats)) return [];
  return formats.map((format) => String(format).trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
}

function chooseLiveFormat(auth: XtreamAuth): string {
  allowedLiveFormats = normalizedFormats(auth.user_info?.allowed_output_formats);
  const requested = formatInput.value as LiveFormat;
  if (requested !== 'auto') {
    if (!allowedLiveFormats.length || allowedLiveFormats.includes(requested)) return requested;
    return allowedLiveFormats.includes('ts') ? 'ts' : allowedLiveFormats.includes('m3u8') ? 'm3u8' : allowedLiveFormats[0];
  }
  if (allowedLiveFormats.includes('ts')) return 'ts';
  if (allowedLiveFormats.includes('m3u8')) return 'm3u8';
  return allowedLiveFormats[0] ?? 'ts';
}

// Keep playlist rendering compatible with older webOS DOM implementations.
function clearChildren(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function showCatalog(cachedAt?: number): void {
  clearChildren(categorySelect);
  categorySelect.appendChild(new Option('All categories', 'all'));
  for (const category of categories) {
    if (category.category_id === undefined || !category.category_name) continue;
    categorySelect.add(new Option(category.category_name, String(category.category_id)));
  }
  stateLabel.textContent = `${channels.length} channels`;
  setupSection.classList.add('hidden');
  librarySection.classList.remove('hidden');
  renderChannels();
  if (cachedAt) {
    const ageHours = Math.max(0, Math.floor((Date.now() - cachedAt) / (60 * 60 * 1000)));
    libraryMessage.textContent = `Showing saved channels${ageHours ? ` · saved ${ageHours}h ago` : ''}.`;
    libraryMessage.classList.remove('hidden', 'error', 'loading');
  } else {
    libraryMessage.textContent = '';
    libraryMessage.classList.add('hidden');
  }
}

async function loadProvider(options: { startup?: boolean } = {}): Promise<void> {
  setBusy(true);
  setProgress('Checking provider URL…');
  let cache: CachedCatalog | null = null;
  let cacheKey = '';
  try {
    const base = normalizedBase(serverInput.value);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) throw new Error('Enter both username and password.');
    credentials = { base, username, password };
    cacheKey = catalogKey(base, username);

    try {
      cache = await readCatalog(cacheKey);
    } catch {
      // A cache failure must never prevent connecting to the provider.
    }
    if (cache && Array.isArray(cache.channels) && cache.channels.length) {
      categories = Array.isArray(cache.categories) ? cache.categories : [];
      channels = cache.channels;
      playbackBase = cache.playbackBase ?? base;
      allowedLiveFormats = Array.isArray(cache.allowedFormats) ? cache.allowedFormats : [];
      activeLiveFormat = cache.liveFormat ?? null;
      showCatalog(cache.savedAt);
      const fresh = Date.now() - cache.savedAt < CATALOG_REFRESH_MS;
      if (fresh && options.startup) {
        stateLabel.textContent = `${channels.length} channels · saved`;
        libraryMessage.textContent = 'Using your saved channels. They refresh automatically after 24 hours.';
        setBusy(false);
        return;
      }
      libraryMessage.textContent = 'Showing saved channels while checking for updates…';
      libraryMessage.classList.remove('hidden', 'error');
      libraryMessage.classList.add('loading');
      stateLabel.textContent = 'Refreshing saved channels…';
    }

    // Persist before network access so a failed/slow provider request cannot
    // discard what the user entered. The opt-out removes any older saved login.
    if (rememberProviderInput.checked) {
      if (!saveProvider({ base, username, password, format: formatInput.value as LiveFormat })) {
        throw new Error('TV storage could not save the login. Uncheck “Remember this login” to connect without saving.');
      }
    } else {
      forgetProvider();
    }

    setProgress('Checking your provider login…');
    const auth = await api<XtreamAuth>(undefined, {}, 60_000);
    assertAuthenticated(auth);
    playbackBase = providerPlaybackServer(auth, base);
    activeLiveFormat = chooseLiveFormat(auth);
    let categoryWarning = '';
    setProgress('Login accepted. Loading categories…');
    const categoryResponse = await api<Category[]>('get_live_categories', {}, 90_000).catch(() => {
      categoryWarning = 'Categories are unavailable; showing channels without category names. ';
      return cache?.categories ?? [];
    });
    categories = Array.isArray(categoryResponse) ? categoryResponse : [];

    setProgress('Login accepted. Loading live channels; this can take a few minutes…');
    const channelResponse = await api<Channel[]>('get_live_streams', {}, 180_000);
    if (!Array.isArray(channelResponse)) throw new Error('Provider returned an invalid live channel list.');
    channels = channelResponse.filter((channel) => channel && channel.stream_id !== undefined && channel.name);
    if (!channels.length) throw new Error('The provider account has no live channels.');

    const refreshedAt = Date.now();
    try {
      await writeCatalog({
        key: cacheKey,
        savedAt: refreshedAt,
        categories,
        channels,
        playbackBase: playbackBase ?? base,
        allowedFormats: allowedLiveFormats,
        liveFormat: activeLiveFormat ?? 'ts'
      });
    } catch {
      // Catalog caching is best-effort on TVs with restricted storage.
    }
    showCatalog();
    passwordInput.value = '';
    if (categoryWarning) {
      libraryMessage.textContent = categoryWarning;
      libraryMessage.classList.remove('hidden', 'loading');
    }
    channelList.querySelector<HTMLButtonElement>('button')?.focus();
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Connection failed.';
    if (cache && channels.length) {
      libraryMessage.textContent = `Could not refresh channels. Showing the saved list. ${safeMessage}`;
      libraryMessage.classList.remove('hidden', 'loading');
      libraryMessage.classList.add('error');
      stateLabel.textContent = `${channels.length} saved channels`;
    } else {
      credentials = null;
      setMessage(safeMessage, true);
      stateLabel.textContent = 'Connection failed';
    }
  } finally {
    setBusy(false);
  }
}

function renderChannels(append = false): void {
  const category = categorySelect.value;
  visibleChannels = channels.filter((channel) => category === 'all' || String(channel.category_id ?? '') === category);
  if (!append) {
    renderedCount = 0;
    clearChildren(channelList);
  }
  const next = visibleChannels.slice(renderedCount, renderedCount + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  for (const channel of next) {
    const button = document.createElement('button');
    button.className = 'channel-card';
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.dataset.streamId = String(channel.stream_id);
    button.setAttribute('aria-label', `Play ${channel.name}`);
    const number = document.createElement('span');
    number.className = 'channel-number';
    number.textContent = String(channel.num ?? '•');
    const name = document.createElement('span');
    name.className = 'channel-name';
    name.textContent = channel.name ?? 'Unknown channel';
    button.appendChild(number);
    button.appendChild(name);
    button.addEventListener('click', () => playChannel(channel));
    fragment.appendChild(button);
  }
  channelList.appendChild(fragment);
  renderedCount += next.length;
  moreButton.classList.toggle('hidden', renderedCount >= visibleChannels.length);
  if (!visibleChannels.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No channels in this category.';
    channelList.appendChild(empty);
  }
}

function streamUrl(channel: Channel): string {
  if (!credentials) throw new Error('Provider is disconnected.');
  const ext = activeLiveFormat ?? chooseLiveFormat({});
  const path = ['live', credentials.username, credentials.password, `${channel.stream_id}.${ext}`]
    .map((part) => encodeURIComponent(part)).join('/');
  return `${playbackBase ?? credentials.base}/${path}`;
}

async function playChannel(channel: Channel): Promise<void> {
  selectedChannel = channel;
  playingTitle.textContent = channel.name ?? 'Live TV';
  playerMessage.textContent = 'Connecting to stream…';
  playerLayer.classList.remove('hidden');
  playPauseButton.textContent = 'Pause';
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.src = streamUrl(channel);
  video.load();
  try {
    await video.play();
    playerMessage.textContent = '';
    playPauseButton.focus();
  } catch (error) {
    playerMessage.textContent = describePlaybackFailure(error);
  }
}

function describePlaybackFailure(error?: unknown): string {
  const mediaError = video.error;
  if (mediaError) {
    if (mediaError.code === MediaError.MEDIA_ERR_NETWORK) return 'The TV could not load this stream. Check provider access, URL format, and network connection.';
    if (mediaError.code === MediaError.MEDIA_ERR_DECODE) return 'The stream reached the TV, but its video or audio codec could not be decoded.';
    if (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return 'This stream format or codec is not supported by the TV. Try the other live format.';
    if (mediaError.code === MediaError.MEDIA_ERR_ABORTED) return 'Stream loading was interrupted.';
  }
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'The TV blocked playback. Press Play to try again.';
  if (name === 'NotSupportedError') return 'This stream format or codec is not supported by the TV. Try the other live format.';
  return 'Playback did not start. Try the other live format or another channel.';
}

function closePlayer(): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
  playerLayer.classList.add('hidden');
  playerMessage.textContent = '';
  selectedChannel = null;
  channelList.querySelector<HTMLButtonElement>('button')?.focus();
}

function switchChannel(direction: -1 | 1): void {
  if (!selectedChannel || !visibleChannels.length) return;
  const index = visibleChannels.findIndex((channel) => String(channel.stream_id) === String(selectedChannel?.stream_id));
  const nextIndex = (index + direction + visibleChannels.length) % visibleChannels.length;
  void playChannel(visibleChannels[nextIndex]);
}

function disconnect(): void {
  closePlayer();
  requestController?.abort();
  credentials = null;
  playbackBase = null;
  activeLiveFormat = null;
  categories = [];
  channels = [];
  visibleChannels = [];
  renderedCount = 0;
  clearChildren(categorySelect);
  categorySelect.appendChild(new Option('All categories', 'all'));
  clearChildren(channelList);
  librarySection.classList.add('hidden');
  setupSection.classList.remove('hidden');
  stateLabel.textContent = 'Not connected';
  const saved = rememberProviderInput.checked ? readSavedProvider() : null;
  serverInput.value = saved?.base ?? '';
  usernameInput.value = saved?.username ?? '';
  passwordInput.value = saved?.password ?? '';
  if (saved) formatInput.value = saved.format;
  setMessage(saved ? 'Disconnected. Your saved login remains on this TV.' : 'Disconnected. Session credentials were cleared.');
  serverInput.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadProvider();
});
saveProviderButton.addEventListener('click', saveCurrentProvider);
categorySelect.addEventListener('change', () => renderChannels());
moreButton.addEventListener('click', () => renderChannels(true));
$('disconnect-button').addEventListener('click', disconnect);
$('close-player').addEventListener('click', closePlayer);
$('previous-channel').addEventListener('click', () => switchChannel(-1));
$('next-channel').addEventListener('click', () => switchChannel(1));
playPauseButton.addEventListener('click', () => {
  if (video.paused) void video.play().catch(() => { playerMessage.textContent = 'Playback could not resume.'; });
  else video.pause();
});
video.addEventListener('playing', () => { playerMessage.textContent = ''; playPauseButton.textContent = 'Pause'; });
video.addEventListener('pause', () => { if (selectedChannel) playPauseButton.textContent = 'Play'; });
video.addEventListener('waiting', () => { playerMessage.textContent = 'Buffering…'; });
video.addEventListener('error', () => {
  if (!playerLayer.classList.contains('hidden')) playerMessage.textContent = describePlaybackFailure();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' || event.key === 'Backspace' || event.keyCode === 461 || event.keyCode === 10009) {
    if (!playerLayer.classList.contains('hidden')) {
      event.preventDefault();
      closePlayer();
    }
    return;
  }
  if (playerLayer.classList.contains('hidden')) return;
  if (event.keyCode === 427 || event.keyCode === 33) {
    event.preventDefault();
    switchChannel(1);
  } else if (event.keyCode === 428 || event.keyCode === 34) {
    event.preventDefault();
    switchChannel(-1);
  } else if (event.keyCode === 10252 || event.keyCode === 179 || event.keyCode === 415 || event.keyCode === 19) {
    event.preventDefault();
    if (video.paused) void video.play().catch(() => { playerMessage.textContent = 'Playback could not resume.'; });
    else video.pause();
  }
});

const savedProvider = readSavedProvider();
const localProvider = {
  base: (import.meta.env.VITE_XTREAM_URL ?? '').trim(),
  username: (import.meta.env.VITE_XTREAM_USERNAME ?? '').trim(),
  password: import.meta.env.VITE_XTREAM_PASSWORD ?? ''
};
if (localProvider.base && localProvider.username && localProvider.password) {
  serverInput.value = localProvider.base;
  usernameInput.value = localProvider.username;
  passwordInput.value = localProvider.password;
  setMessage('Using local test-provider settings embedded in this build.');
  window.setTimeout(() => { void loadProvider({ startup: true }); }, 300);
} else if (savedProvider) {
  rememberProviderInput.checked = true;
  serverInput.value = savedProvider.base;
  usernameInput.value = savedProvider.username;
  passwordInput.value = savedProvider.password;
  formatInput.value = savedProvider.format;
  setMessage('Reconnecting with the login saved on this TV…');
  window.setTimeout(() => { void loadProvider({ startup: true }); }, 300);
}

