import './style.css';
import {
  readCatalog,
  writeCatalog,
  type CachedCatalog,
  type CatalogCategory as Category,
  type CatalogChannel as Channel,
  type CatalogMovie as Movie,
  type CatalogSeries as Series,
  type SeriesEpisode
} from './catalogCache';

type XtreamAuth = {
  user_info?: { auth?: number; status?: string; exp_date?: string | null; allowed_output_formats?: string[] };
  server_info?: { url?: string; port?: string | number; https_port?: string | number; server_protocol?: string };
};

type LiveFormat = 'auto' | 'ts' | 'm3u8';
type CatalogView = 'live' | 'movies' | 'series';
type AppPage = 'home' | 'search' | 'movies' | 'series' | 'live' | 'my-list' | 'settings' | 'detail';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing app element: ${id}`);
  return element as T;
};

const form = $('connect-form') as HTMLFormElement;
const serverInput = $('server') as HTMLInputElement;
const providerTypeSelect = $('provider-type') as HTMLSelectElement;
const serverLabel = $('server-label');
const credentialFields = $('credentials-fields');
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
const appLayout = $('app-layout');
const sidebar = $('sidebar');
const homeView = $('home-view');
const detailView = $('detail-view');
const settingsView = $('settings-view');
const myListView = $('my-list-view');
const myListItems = $('my-list-items');
const heroTitle = $('hero-title');
const heroDescription = $('hero-description');
const heroArt = $('hero-art') as HTMLImageElement;
const heroPlayButton = $('hero-play') as HTMLButtonElement;
const heroBrowseButton = $('hero-browse') as HTMLButtonElement;
const homeMovies = $('home-movies');
const homeSeries = $('home-series');
const homeContinue = $('home-continue');
const continueRow = $('continue-row');
const languageFilter = $('language-filter');
const detailPoster = $('detail-poster') as HTMLImageElement;
const detailKind = $('detail-kind');
const detailTitle = $('detail-title');
const detailMeta = $('detail-meta');
const detailDescription = $('detail-description');
const detailPlayButton = $('detail-play') as HTMLButtonElement;
const detailListButton = $('detail-list') as HTMLButtonElement;
const detailStartOverButton = $('detail-start-over') as HTMLButtonElement;
const settingsCategoryType = $('settings-category-type') as HTMLSelectElement;
const categoryVisibilityList = $('category-visibility-list');
const categorySelect = $('category') as HTMLSelectElement;
const channelList = $('channel-list');
const catalogTitle = $('catalog-title');
const catalogTypeSelect = $('catalog-type') as HTMLSelectElement;
const searchInput = $('catalog-search') as HTMLInputElement;
const backToSeriesButton = $('back-to-series') as HTMLButtonElement;
const moreButton = $('more-button') as HTMLButtonElement;
const libraryMessage = $('library-message');
const playerLayer = $('player');
const exitConfirm = $('exit-confirm');
const backHint = $('back-hint');
const video = $('video') as HTMLVideoElement;
const playerMessage = $('player-message');
const playingTitle = $('playing-title');
const playPauseButton = $('play-pause') as HTMLButtonElement;
const seekBackButton = $('seek-back') as HTMLButtonElement;
const seekForwardButton = $('seek-forward') as HTMLButtonElement;
const previousChannelButton = $('previous-channel') as HTMLButtonElement;
const nextChannelButton = $('next-channel') as HTMLButtonElement;
const seekRow = $('seek-row');
const seekBar = $('seek-bar') as HTMLInputElement;
const seekCurrent = $('seek-current');
const seekDuration = $('seek-duration');

const PAGE_SIZE = 72;
const CATALOG_REFRESH_MS = 24 * 60 * 60 * 1000;
const REMEMBERED_PROVIDER_KEY = 'nextflix.xtream.provider.v1';
const APP_VERSION = '0.3.6';
const versionLabel = $('app-version');
versionLabel.textContent = `NextFlix ${APP_VERSION}`;
type SavedProvider = { base: string; username: string; password: string; format: LiveFormat; kind?: 'xtream' | 'm3u' };
let credentials: { base: string; username: string; password: string } | null = null;
let playbackBase: string | null = null;
let watchScope = 'default';
let allowedLiveFormats: string[] = [];
let activeLiveFormat: string | null = null;
let categories: Category[] = [];
let channels: Channel[] = [];
let movieCategories: Category[] = [];
let movies: Movie[] = [];
let seriesCategories: Category[] = [];
let series: Series[] = [];
let seriesEpisodes: SeriesEpisode[] = [];
let activeSeries: Series | null = null;
let catalogView: CatalogView = 'live';
let currentPage: AppPage = 'home';
let previousPage: AppPage = 'home';
let detailReturnFocus: HTMLElement | null = null;
let detailItem: { kind: 'movie'; item: Movie } | { kind: 'series'; item: Series } | null = null;
let featuredItem: { kind: 'movie'; item: Movie } | { kind: 'series'; item: Series } | null = null;
let hiddenCategoryIds: Record<CatalogView, Set<string>> = { live: new Set(), movies: new Set(), series: new Set() };
let hiddenCategoriesKey = 'nextflix.hidden-categories.v1';
let languageFilterKey = 'nextflix.language-filter.v1';
let activeLanguageFilters: Record<CatalogView, string> = { live: 'all', movies: 'all', series: 'all' };
let favorites = new Set<string>();
const FAVORITES_KEY = 'nextflix.my-list.v1';
const WATCH_HISTORY_KEY = 'nextflix.watch-history.v1';
type WatchProgress = {
  key: string;
  scope: string;
  kind: 'movie' | 'series';
  id: string;
  title: string;
  extension: string;
  poster?: string;
  categoryId?: string;
  seriesId?: string;
  seriesTitle?: string;
  season?: string;
  episodeNumber?: string;
  position: number;
  duration: number;
  updatedAt: number;
};
let watchHistory: WatchProgress[] = [];
let currentVodEntry: WatchProgress | null = null;
let lastProgressWrite = 0;
let searchTimer = 0;
let sourceType: 'xtream' | 'm3u' = 'xtream';
let visibleChannels: Channel[] = [];
let renderedCount = 0;
let selectedChannel: Channel | null = null;
let requestController: AbortController | null = null;
let backPressCount = 0;
let backPressResetTimer = 0;
let backHintTimer = 0;
let seekHoldTimer = 0;
let seekHoldDirection: -1 | 1 | 0 = 0;
let seekHoldStartedAt = 0;
let seekHoldLastSignal = 0;
let openDropdown: HTMLSelectElement | null = null;

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
      format: saved.format === 'm3u8' || saved.format === 'auto' ? saved.format : 'ts',
      kind: saved.kind === 'm3u' ? 'm3u' : 'xtream'
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
    if (providerTypeSelect.value === 'xtream' && (!username || !password)) throw new Error('Enter the URL, username, and password before saving.');
    const saved = { base, username, password, format: formatInput.value as LiveFormat, kind: providerTypeSelect.value === 'm3u' ? 'm3u' as const : 'xtream' as const };
    if (!saveProvider(saved)) throw new Error('TV storage did not confirm the saved login.');
    rememberProviderInput.checked = true;
    setMessage('Login saved on this TV.');
    return true;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Could not save the login.', true);
    return false;
  }
}

function updateSourceTypeControls(): void {
  const playlist = providerTypeSelect.value === 'm3u';
  credentialFields.classList.toggle('hidden', playlist);
  usernameInput.required = !playlist;
  passwordInput.required = !playlist;
  serverLabel.textContent = playlist ? 'M3U playlist URL' : 'Server URL';
  serverInput.placeholder = playlist ? 'https://provider.example/playlist.m3u' : 'https://provider.example:8080';
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

function m3uCatalogKey(url: string): string {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `m3u:${(hash >>> 0).toString(16)}`;
}

function parseM3U(text: string): { channels: Channel[]; categories: Category[] } {
  const channels: Channel[] = [];
  const categoryIds = new Map<string, number>();
  let pending: { title?: string; tvgId?: string; logo?: string; group?: string } | null = null;
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attr = (name: string): string | undefined => {
        const match = line.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i'));
        return match?.[1];
      };
      const comma = line.lastIndexOf(',');
      pending = {
        title: attr('tvg-name') || (comma >= 0 ? line.slice(comma + 1).trim() : undefined),
        tvgId: attr('tvg-id'),
        logo: attr('tvg-logo'),
        group: attr('group-title') || 'Other'
      };
    } else if (!line.startsWith('#') && pending) {
      let categoryId = categoryIds.get(pending.group ?? 'Other');
      if (categoryId === undefined) {
        categoryId = categoryIds.size + 1;
        categoryIds.set(pending.group ?? 'Other', categoryId);
      }
      channels.push({
        num: channels.length + 1,
        stream_id: channels.length + 1,
        stream_url: line,
        name: pending.title || line,
        stream_icon: pending.logo,
        category_id: categoryId,
        epg_channel_id: pending.tvgId
      });
      pending = null;
    }
  }
  const categories = Array.from(categoryIds.entries()).map(([category_name, category_id]) => ({ category_id, category_name }));
  return { channels, categories };
}

async function fetchM3U(url: string): Promise<string> {
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const timeout = window.setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(url, { headers: { Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*' }, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Playlist returned HTTP ${response.status}.`);
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Playlist returned')) throw error;
    if (controller.signal.aborted) throw new Error('The playlist request timed out.');
    throw new Error('Could not download the M3U playlist. Check its URL, network access, TLS, and browser CORS support.');
  } finally {
    window.clearTimeout(timeout);
    if (requestController === controller) requestController = null;
  }
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

function categoriesFor(view: CatalogView): Category[] {
  if (view === 'movies') return movieCategories;
  if (view === 'series') return seriesCategories;
  return categories;
}

function categoriesForView(): Category[] {
  return categoriesFor(catalogView);
}

function categoryLanguageTag(categoryName: string | undefined): string {
  if (!categoryName || categoryName.indexOf('|') < 0) return '';
  const segments = categoryName.trim().split('|');
  const tagSegment = segments[0].trim() ? segments[0] : segments[1] ?? '';
  return tagSegment.trim();
}

function languagesForView(view: CatalogView): string[] {
  const found = new Map<string, string>();
  for (const category of categoriesFor(view)) {
    const tag = categoryLanguageTag(category.category_name);
    if (tag && !found.has(tag.toUpperCase())) found.set(tag.toUpperCase(), tag);
  }
  return Array.from(found.values()).sort((left, right) => left.localeCompare(right));
}

function selectedLanguageView(): CatalogView {
  return currentPage === 'settings' ? settingsCategoryType.value as CatalogView : catalogView;
}

function renderLanguageFilter(): void {
  const visible = currentPage === 'settings' || currentPage === 'movies' || currentPage === 'series' || currentPage === 'live';
  languageFilter.classList.toggle('hidden', !visible);
  clearChildren(languageFilter);
  if (!visible) return;

  const view = selectedLanguageView();
  const available = languagesForView(view);
  if (activeLanguageFilters[view] !== 'all' && available.indexOf(activeLanguageFilters[view]) < 0) {
    activeLanguageFilters[view] = 'all';
  }
  const options = [{ value: 'all', label: 'All' }, ...available.map((label) => ({ value: label.toUpperCase(), label }))];
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `language-choice${activeLanguageFilters[view] === option.value ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(activeLanguageFilters[view] === option.value));
    button.setAttribute('aria-label', option.value === 'all' ? 'All languages' : option.label);
    button.title = option.label;
    button.textContent = option.label;
    button.addEventListener('click', () => {
      activeLanguageFilters[view] = option.value;
      try { localStorage.setItem(languageFilterKey, JSON.stringify(activeLanguageFilters)); } catch { /* Session-only filter selection. */ }
      renderLanguageFilter();
      if (currentPage === 'settings') {
        renderCategorySettings();
      } else {
        updateCatalogHeading();
        renderChannels();
      }
    });
    languageFilter.appendChild(button);
  }
}

function isCategoryEnabled(view: CatalogView, categoryId: string | number | undefined): boolean {
  return categoryId === undefined || !hiddenCategoryIds[view].has(String(categoryId));
}

function isCategoryVisible(view: CatalogView, categoryId: string | number | undefined): boolean {
  if (!isCategoryEnabled(view, categoryId)) return false;
  const language = activeLanguageFilters[view];
  if (language === 'all') return true;
  const category = categoriesFor(view).find((item) => String(item.category_id ?? '') === String(categoryId ?? ''));
  return !!category && categoryLanguageTag(category.category_name).toUpperCase() === language;
}

function saveHiddenCategories(): void {
  try {
    localStorage.setItem(hiddenCategoriesKey, JSON.stringify({
      live: Array.from(hiddenCategoryIds.live),
      movies: Array.from(hiddenCategoryIds.movies),
      series: Array.from(hiddenCategoryIds.series)
    }));
  } catch { /* Category visibility remains session-local if storage is unavailable. */ }
}

function loadHiddenCategories(key: string): void {
  hiddenCategoriesKey = `nextflix.hidden-categories.${m3uCatalogKey(key)}`;
  languageFilterKey = `nextflix.language-filter.${m3uCatalogKey(key)}`;
  try {
    const saved = JSON.parse(localStorage.getItem(hiddenCategoriesKey) ?? '{}') as Partial<Record<CatalogView, unknown>>;
    for (const view of ['live', 'movies', 'series'] as CatalogView[]) {
      hiddenCategoryIds[view] = Array.isArray(saved[view]) ? new Set((saved[view] as unknown[]).map(String)) : new Set();
    }
  } catch {
    hiddenCategoryIds = { live: new Set(), movies: new Set(), series: new Set() };
  }
  try {
    const savedLanguageFilters = JSON.parse(localStorage.getItem(languageFilterKey) ?? '{}') as Partial<Record<CatalogView, unknown>>;
    activeLanguageFilters = {
      live: typeof savedLanguageFilters.live === 'string' ? savedLanguageFilters.live : 'all',
      movies: typeof savedLanguageFilters.movies === 'string' ? savedLanguageFilters.movies : 'all',
      series: typeof savedLanguageFilters.series === 'string' ? savedLanguageFilters.series : 'all'
    };
  } catch {
    activeLanguageFilters = { live: 'all', movies: 'all', series: 'all' };
  }
}

function loadWatchHistory(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) ?? '[]') as unknown;
    watchHistory = Array.isArray(saved)
      ? (saved as WatchProgress[]).filter((entry) => entry && (entry.kind === 'movie' || entry.kind === 'series')
        && typeof entry.scope === 'string' && typeof entry.id === 'string' && typeof entry.title === 'string'
        && Number.isFinite(entry.position) && Number.isFinite(entry.duration) && entry.duration > 0)
        .sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 40)
      : [];
  } catch {
    watchHistory = [];
  }
}

function persistWatchHistory(): void {
  try { localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(watchHistory)); } catch { /* Resume data stays in memory if storage is full. */ }
}

function playbackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function updatePlayPauseControl(isPlaying: boolean): void {
  playPauseButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  playPauseButton.title = isPlaying ? 'Pause' : 'Play';
  playPauseButton.innerHTML = isPlaying
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z" /></svg>';
}

function updatePlaybackControls(): void {
  const live = selectedChannel !== null;
  previousChannelButton.classList.toggle('hidden', !live);
  nextChannelButton.classList.toggle('hidden', !live);
  seekBackButton.classList.toggle('hidden', live);
  seekForwardButton.classList.toggle('hidden', live);
}

function watchEntryForMovie(id: number | string): WatchProgress | undefined {
  return watchHistory.find((entry) => entry.scope === watchScope && entry.kind === 'movie' && entry.id === String(id));
}

function updateSeekControls(): void {
  const duration = video.duration;
  const canSeek = Number.isFinite(duration) && duration > 0;
  seekRow.classList.toggle('hidden', !canSeek);
  if (!canSeek) return;
  const current = Math.max(0, Math.min(video.currentTime || 0, duration));
  seekCurrent.textContent = playbackTime(current);
  seekDuration.textContent = playbackTime(duration);
  seekBar.value = String(Math.round((current / duration) * Number(seekBar.max)));
}

function saveWatchProgress(force = false, completed = false): void {
  if (!currentVodEntry) return;
  const duration = video.duration;
  const position = video.currentTime;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
  const now = Date.now();
  if (!force && now - lastProgressWrite < 12000) return;
  lastProgressWrite = now;
  const existing = watchHistory.find((entry) => entry.key === currentVodEntry?.key);
  if (completed || position >= duration * 0.92) {
    watchHistory = watchHistory.filter((entry) => entry.key !== currentVodEntry?.key);
  } else {
    if (position < 8 && !existing) return;
    const entry: WatchProgress = { ...currentVodEntry, position, duration, updatedAt: now };
    currentVodEntry = entry;
    watchHistory = [entry, ...watchHistory.filter((item) => item.key !== entry.key)]
      .sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 40);
  }
  persistWatchHistory();
  if (currentPage === 'home') renderContinueWatching();
}

function renderContinueWatching(): void {
  clearChildren(homeContinue);
  const entries = watchHistory.filter((entry) => entry.scope === watchScope)
    .sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 12);
  continueRow.classList.toggle('hidden', entries.length === 0);
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'continue-tile';
    button.setAttribute('aria-label', `Resume ${entry.title} at ${playbackTime(entry.position)}`);
    if (entry.poster) {
      const image = document.createElement('img');
      image.src = entry.poster;
      image.alt = '';
      image.setAttribute('loading', 'lazy');
      image.addEventListener('error', () => image.classList.add('hidden'));
      button.appendChild(image);
    }
    const title = document.createElement('span');
    title.className = 'continue-tile-title';
    title.textContent = entry.seriesTitle
      ? `${entry.seriesTitle} · S${entry.season ?? '?'} E${entry.episodeNumber ?? '?'}`
      : entry.title;
    const meta = document.createElement('span');
    meta.className = 'continue-tile-meta';
    meta.textContent = `Continue · ${playbackTime(entry.position)}`;
    const progress = document.createElement('div');
    progress.className = 'continue-progress';
    const progressFill = document.createElement('span');
    progressFill.style.width = `${Math.max(0, Math.min(100, (entry.position / entry.duration) * 100))}%`;
    progress.appendChild(progressFill);
    button.appendChild(title);
    button.appendChild(meta);
    button.appendChild(progress);
    button.addEventListener('click', () => {
      void playVod(entry.title, entry.id, entry.extension, entry.kind, { historyEntry: entry });
    });
    homeContinue.appendChild(button);
  }
}

function favoriteKey(kind: 'movie' | 'series', id: number | string): string {
  return `${kind}:${id}`;
}

function saveFavorites(): void {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites))); } catch { /* Keep favorites in memory for this session. */ }
}

function toggleFavorite(kind: 'movie' | 'series', id: number | string): void {
  const key = favoriteKey(kind, id);
  if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
  saveFavorites();
  detailListButton.textContent = favorites.has(key) ? 'Remove from My List' : 'Add to My List';
  if (currentPage === 'my-list') renderMyList();
}

function showMovieDetails(item: Movie): void {
  if (currentPage !== 'detail') {
    previousPage = currentPage;
    detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  detailItem = { kind: 'movie', item };
  detailKind.textContent = 'MOVIE';
  detailTitle.textContent = item.name ?? 'Untitled movie';
  detailMeta.textContent = [item.year, item.rating ? `★ ${item.rating}` : ''].filter(Boolean).join(' · ');
  detailDescription.textContent = item.plot ?? 'No description supplied by the provider.';
  detailPoster.src = item.stream_icon ?? '';
  detailPoster.classList.toggle('hidden', !item.stream_icon);
  const resumeEntry = watchEntryForMovie(item.stream_id);
  detailPlayButton.textContent = resumeEntry ? `Resume · ${playbackTime(resumeEntry.position)}` : 'Play movie';
  detailStartOverButton.classList.toggle('hidden', !resumeEntry);
  detailListButton.textContent = favorites.has(favoriteKey('movie', item.stream_id)) ? 'Remove from My List' : 'Add to My List';
  showPage('detail');
  detailPlayButton.focus();
}

function showSeriesDetails(item: Series): void {
  if (currentPage !== 'detail') {
    previousPage = currentPage;
    detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  detailItem = { kind: 'series', item };
  detailKind.textContent = 'SERIES';
  detailTitle.textContent = item.name ?? 'Untitled series';
  detailMeta.textContent = [item.releaseDate, item.genre, item.rating ? `★ ${item.rating}` : ''].filter(Boolean).join(' · ');
  detailDescription.textContent = item.plot ?? 'No description supplied by the provider.';
  detailPoster.src = item.cover ?? '';
  detailPoster.classList.toggle('hidden', !item.cover);
  detailPlayButton.textContent = 'View episodes';
  detailStartOverButton.classList.add('hidden');
  detailListButton.textContent = favorites.has(favoriteKey('series', item.series_id)) ? 'Remove from My List' : 'Add to My List';
  showPage('detail');
  detailPlayButton.focus();
}

function renderPosterRow(container: HTMLElement, kind: 'movie' | 'series', items: Array<Movie | Series>): void {
  clearChildren(container);
  for (const raw of items.slice(0, 12)) {
    const item = raw as Movie & Series;
    const title = item.name ?? 'Untitled';
    const posterUrl = kind === 'movie' ? (item as Movie).stream_icon : (item as Series).cover;
    if (!isCategoryEnabled(kind === 'movie' ? 'movies' : 'series', item.category_id)) continue;
    const button = document.createElement('button');
    button.className = 'poster-tile';
    button.type = 'button';
    button.setAttribute('aria-label', `Open ${title}`);
    if (posterUrl) {
      const image = document.createElement('img');
      image.src = posterUrl;
      image.alt = '';
      image.setAttribute('loading', 'lazy');
      image.addEventListener('error', () => image.classList.add('hidden'));
      button.appendChild(image);
    }
    const label = document.createElement('span');
    label.textContent = title;
    button.appendChild(label);
    button.addEventListener('click', () => kind === 'movie' ? showMovieDetails(item as Movie) : showSeriesDetails(item as Series));
    container.appendChild(button);
  }
}

function renderHome(): void {
  const firstMovie = movies.find((item) => isCategoryEnabled('movies', item.category_id));
  const firstSeries = series.find((item) => isCategoryEnabled('series', item.category_id));
  featuredItem = firstMovie ? { kind: 'movie', item: firstMovie } : firstSeries ? { kind: 'series', item: firstSeries } : null;
  if (featuredItem) {
    const item = featuredItem.item;
    heroTitle.textContent = item.name ?? 'Featured title';
    heroDescription.textContent = item.plot ?? (featuredItem.kind === 'movie' ? 'Featured from your movie catalog.' : 'Featured from your series catalog.');
    const poster = featuredItem.kind === 'movie' ? (item as Movie).stream_icon : (item as Series).cover;
    if (poster) {
      heroArt.src = poster;
      heroArt.classList.remove('hidden');
    } else {
      heroArt.removeAttribute('src');
      heroArt.classList.add('hidden');
    }
    heroPlayButton.classList.remove('hidden');
  } else {
    heroTitle.textContent = 'Your IPTV library';
    heroDescription.textContent = 'Movies and series from your provider will appear here.';
    heroArt.removeAttribute('src');
    heroArt.classList.add('hidden');
    heroPlayButton.classList.add('hidden');
  }
  renderPosterRow(homeMovies, 'movie', movies.slice().sort((a, b) => Number(b.added ?? 0) - Number(a.added ?? 0)));
  renderPosterRow(homeSeries, 'series', series);
  renderContinueWatching();
}

function renderMyList(): void {
  clearChildren(myListItems);
  for (const key of favorites) {
    const [kind, ...idParts] = key.split(':');
    const id = idParts.join(':');
    const movie = kind === 'movie' ? movies.find((item) => String(item.stream_id) === id) : undefined;
    const show = kind === 'series' ? series.find((item) => String(item.series_id) === id) : undefined;
    const title = movie?.name ?? show?.name;
    if (!title) continue;
    const button = document.createElement('button');
    button.className = 'media-card';
    button.type = 'button';
    const posterUrl = movie?.stream_icon ?? show?.cover;
    if (posterUrl) {
      const image = document.createElement('img');
      image.className = 'media-poster';
      image.src = posterUrl;
      image.alt = '';
      image.setAttribute('loading', 'lazy');
      button.appendChild(image);
    }
    const label = document.createElement('span');
    label.className = 'media-card-title';
    label.textContent = title;
    button.appendChild(label);
    button.addEventListener('click', () => movie ? showMovieDetails(movie) : showSeriesDetails(show!));
    myListItems.appendChild(button);
  }
  if (!myListItems.firstChild) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Your list is empty. Open a movie or series and add it to My List.';
    myListItems.appendChild(empty);
  }
}

function renderCategorySettings(): void {
  clearChildren(categoryVisibilityList);
  const view = settingsCategoryType.value as CatalogView;
  const language = activeLanguageFilters[view];
  for (const category of categoriesFor(view)) {
    if (category.category_id === undefined || !category.category_name) continue;
    if (language !== 'all' && categoryLanguageTag(category.category_name).toUpperCase() !== language) continue;
    const label = document.createElement('label');
    label.className = 'category-visibility-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !hiddenCategoryIds[view].has(String(category.category_id));
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) hiddenCategoryIds[view].delete(String(category.category_id));
      else hiddenCategoryIds[view].add(String(category.category_id));
      saveHiddenCategories();
      updateCatalogHeading();
      renderChannels();
      renderHome();
    });
    const name = document.createElement('span');
    name.textContent = category.category_name;
    label.appendChild(checkbox);
    label.appendChild(name);
    categoryVisibilityList.appendChild(label);
  }
}

function showPage(page: AppPage): void {
  const leavingDetail = currentPage === 'detail' && page !== 'detail';
  currentPage = page;
  homeView.classList.toggle('hidden', page !== 'home');
  detailView.classList.toggle('hidden', page !== 'detail');
  settingsView.classList.toggle('hidden', page !== 'settings');
  myListView.classList.toggle('hidden', page !== 'my-list');
  const showCatalogPage = page === 'movies' || page === 'series' || page === 'live' || page === 'search';
  librarySection.classList.toggle('hidden', !showCatalogPage);
  if (page === 'movies' || page === 'series' || page === 'live') {
    catalogView = page === 'live' ? 'live' : page;
    catalogTypeSelect.value = catalogView;
    activeSeries = null;
    seriesEpisodes = [];
  }
  if (page === 'search') {
    if (!['live', 'movies', 'series'].includes(catalogView)) catalogView = 'movies';
    catalogTypeSelect.value = catalogView;
  }
  renderLanguageFilter();
  if (showCatalogPage && !leavingDetail) {
    updateCatalogHeading();
    renderChannels();
  }
  if (page === 'home') renderHome();
  if (page === 'settings') renderCategorySettings();
  if (page === 'my-list') renderMyList();
  const selectedNavPage = page === 'detail' ? previousPage : page;
  document.querySelectorAll<HTMLButtonElement>('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.page === selectedNavPage));
  if (page === 'search') window.setTimeout(() => searchInput.focus(), 0);
  if (leavingDetail && detailReturnFocus?.isConnected) {
    detailReturnFocus.focus();
    detailReturnFocus = null;
  }
}

function updateCatalogHeading(): void {
  renderLanguageFilter();
  catalogTitle.textContent = activeSeries
    ? `${activeSeries.name ?? 'Series'} · Episodes`
    : currentPage === 'search' ? 'Search'
      : catalogView === 'movies' ? 'Movies' : catalogView === 'series' ? 'Series' : 'Live TV';
  backToSeriesButton.classList.toggle('hidden', !activeSeries);
  clearChildren(categorySelect);
  categorySelect.appendChild(new Option('All categories', 'all'));
  for (const category of categoriesForView()) {
    if (category.category_id === undefined || !category.category_name || !isCategoryVisible(catalogView, category.category_id)) continue;
    categorySelect.appendChild(new Option(category.category_name, String(category.category_id)));
  }
}

function showCatalog(cachedAt?: number): void {
  updateCatalogHeading();
  stateLabel.textContent = `${channels.length} channels`;
  setupSection.classList.add('hidden');
  appLayout.classList.remove('hidden');
  showPage('home');
  if (cachedAt) {
    const ageHours = Math.max(0, Math.floor((Date.now() - cachedAt) / (60 * 60 * 1000)));
    libraryMessage.textContent = `Showing saved channels${ageHours ? ` · saved ${ageHours}h ago` : ''}.`;
    libraryMessage.classList.remove('hidden', 'error', 'loading');
  } else {
    libraryMessage.textContent = '';
    libraryMessage.classList.add('hidden');
  }
}

async function saveCatalogSnapshot(key: string): Promise<void> {
  try {
    await writeCatalog({
      key,
      savedAt: Date.now(),
      sourceType,
      categories,
      channels,
      movieCategories,
      movies,
      seriesCategories,
      series,
      playbackBase: playbackBase ?? undefined,
      allowedFormats: allowedLiveFormats,
      liveFormat: activeLiveFormat ?? undefined
    });
  } catch {
    // Catalog caching is best-effort on TVs with restricted storage.
  }
}

async function loadMoviesAndSeries(key: string): Promise<void> {
  const warnings: string[] = [];
  if (!credentials) return;
  stateLabel.textContent = 'Loading movies in the background…';
  libraryMessage.textContent = 'Loading movies in the background…';
  libraryMessage.classList.remove('hidden', 'error');
  libraryMessage.classList.add('loading');
  try {
    const categoryResponse = await api<Category[]>('get_vod_categories', {}, 120_000);
    if (Array.isArray(categoryResponse)) movieCategories = categoryResponse;
    if (catalogView === 'movies') updateCatalogHeading();
  } catch {
    warnings.push('movie categories unavailable');
  }
  try {
    const movieResponse = await api<Movie[]>('get_vod_streams', {}, 180_000);
    if (Array.isArray(movieResponse)) movies = movieResponse.filter((item) => item && item.stream_id !== undefined && item.name);
  } catch {
    warnings.push('movies unavailable');
  }
  if (!credentials) return;
  await saveCatalogSnapshot(key);
  if (currentPage === 'movies') renderChannels();
  if (currentPage === 'home') renderHome();

  stateLabel.textContent = 'Loading series in the background…';
  libraryMessage.textContent = 'Loading series in the background…';
  try {
    const categoryResponse = await api<Category[]>('get_series_categories', {}, 120_000);
    if (Array.isArray(categoryResponse)) seriesCategories = categoryResponse;
    if (catalogView === 'series') updateCatalogHeading();
  } catch {
    warnings.push('series categories unavailable');
  }
  try {
    const seriesResponse = await api<Series[]>('get_series', {}, 180_000);
    if (Array.isArray(seriesResponse)) series = seriesResponse.filter((item) => item && item.series_id !== undefined && item.name);
  } catch {
    warnings.push('series unavailable');
  }
  if (!credentials) return;
  await saveCatalogSnapshot(key);
  if (!librarySection.classList.contains('hidden')) {
    updateCatalogHeading();
    renderChannels();
  }
  if (currentPage === 'home') renderHome();
  if (currentPage === 'settings') {
    renderLanguageFilter();
    renderCategorySettings();
  }
  if (currentPage === 'my-list') renderMyList();
  libraryMessage.textContent = warnings.length
    ? `Live TV is ready. ${warnings.join('; ')}. Your provider may not support these catalogs.`
    : `Ready · ${movies.length} movies · ${series.length} series`;
  libraryMessage.classList.remove('hidden', 'error', 'loading');
  stateLabel.textContent = `${channels.length} live channels · ${movies.length} movies · ${series.length} series`;
}

async function loadProvider(options: { startup?: boolean } = {}): Promise<void> {
  setBusy(true);
  setProgress('Checking provider URL…');
  let cache: CachedCatalog | null = null;
  let cacheKey = '';
  try {
    sourceType = providerTypeSelect.value === 'm3u' ? 'm3u' : 'xtream';
    const base = normalizedBase(serverInput.value);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (sourceType === 'xtream' && (!username || !password)) throw new Error('Enter both username and password.');
    credentials = { base, username, password };
    cacheKey = sourceType === 'm3u' ? m3uCatalogKey(base) : catalogKey(base, username);
    watchScope = m3uCatalogKey(cacheKey);
    loadHiddenCategories(cacheKey);

    try {
      cache = await readCatalog(cacheKey);
    } catch {
      // A cache failure must never prevent connecting to the provider.
    }
    if (cache && Array.isArray(cache.channels) && cache.channels.length) {
      categories = Array.isArray(cache.categories) ? cache.categories : [];
      channels = cache.channels;
      movieCategories = Array.isArray(cache.movieCategories) ? cache.movieCategories : [];
      movies = Array.isArray(cache.movies) ? cache.movies : [];
      seriesCategories = Array.isArray(cache.seriesCategories) ? cache.seriesCategories : [];
      series = Array.isArray(cache.series) ? cache.series : [];
      sourceType = cache.sourceType === 'm3u' ? 'm3u' : sourceType;
      playbackBase = cache.playbackBase ?? base;
      allowedLiveFormats = Array.isArray(cache.allowedFormats) ? cache.allowedFormats : [];
      activeLiveFormat = cache.liveFormat ?? null;
      showCatalog(cache.savedAt);
      const fresh = Date.now() - cache.savedAt < CATALOG_REFRESH_MS;
      if (fresh && options.startup && (sourceType === 'm3u' || (Array.isArray(cache.movies) && Array.isArray(cache.series)))) {
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
      if (!saveProvider({ base, username, password, format: formatInput.value as LiveFormat, kind: sourceType })) {
        throw new Error('TV storage could not save the login. Uncheck “Remember this login” to connect without saving.');
      }
    } else {
      forgetProvider();
    }

    if (sourceType === 'm3u') {
      setProgress('Downloading your M3U playlist…');
      const text = await fetchM3U(base);
      const parsed = parseM3U(text);
      if (!parsed.channels.length) throw new Error('The M3U file contains no valid channel entries.');
      categories = parsed.categories;
      channels = parsed.channels;
      movieCategories = [];
      movies = [];
      seriesCategories = [];
      series = [];
      playbackBase = base;
      activeLiveFormat = null;
      await writeCatalog({ key: cacheKey, savedAt: Date.now(), sourceType: 'm3u', categories, channels });
      catalogView = 'live';
      catalogTypeSelect.value = 'live';
      showCatalog();
      libraryMessage.textContent = `${channels.length} channels loaded from M3U.`;
      libraryMessage.classList.remove('hidden', 'loading', 'error');
      document.querySelector<HTMLButtonElement>('.nav-button[data-page="home"]')?.focus();
      return;
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

    await saveCatalogSnapshot(cacheKey);
    showCatalog();
    passwordInput.value = '';
    if (categoryWarning) {
      libraryMessage.textContent = categoryWarning;
      libraryMessage.classList.remove('hidden', 'loading');
    }
    document.querySelector<HTMLButtonElement>('.nav-button[data-page="home"]')?.focus();
    if (sourceType === 'xtream') window.setTimeout(() => { void loadMoviesAndSeries(cacheKey); }, 0);
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
  const query = searchInput.value.trim().toLowerCase();
  visibleChannels = catalogView === 'live' && !activeSeries
    ? channels.filter((channel) => (category === 'all' || String(channel.category_id ?? '') === category)
      && isCategoryVisible('live', channel.category_id)
      && (!query || String(channel.name ?? '').toLowerCase().includes(query)))
    : [];
  const items: Array<{ title: string; poster?: string; meta?: string; channel?: Channel; onSelect: () => void }> = [];
  if (catalogView === 'live' && !activeSeries) {
    for (const channel of visibleChannels) {
      items.push({ title: channel.name ?? 'Unknown channel', meta: String(channel.num ?? 'Live TV'), channel, onSelect: () => playChannel(channel) });
    }
  } else if (activeSeries) {
    for (const episode of seriesEpisodes) {
      const title = episode.title ?? `Episode ${episode.episode_num ?? ''}`.trim();
      if (query && !title.toLowerCase().includes(query)) continue;
      items.push({
        title,
        poster: episode.info?.movie_image,
        meta: `Season ${episode.season ?? '—'} · Episode ${episode.episode_num ?? '—'}`,
        onSelect: () => playVod(title, episode.id, episode.container_extension, 'series')
      });
    }
  } else if (catalogView === 'movies') {
    for (const movie of movies) {
      if (!isCategoryVisible('movies', movie.category_id) || (category !== 'all' && String(movie.category_id ?? '') !== category)) continue;
      const title = movie.name ?? 'Untitled movie';
      if (query && !title.toLowerCase().includes(query)) continue;
      const meta = [movie.year, movie.rating ? `★ ${movie.rating}` : ''].filter(Boolean).join(' · ');
      items.push({ title, poster: movie.stream_icon, meta, onSelect: () => showMovieDetails(movie) });
    }
  } else {
    for (const item of series) {
      if (!isCategoryVisible('series', item.category_id) || (category !== 'all' && String(item.category_id ?? '') !== category)) continue;
      const title = item.name ?? 'Untitled series';
      if (query && !title.toLowerCase().includes(query)) continue;
      items.push({ title, poster: item.cover, meta: [item.releaseDate, item.genre].filter(Boolean).join(' · '), onSelect: () => showSeriesDetails(item) });
    }
  }
  if (!append) {
    renderedCount = 0;
    clearChildren(channelList);
  }
  const next = items.slice(renderedCount, renderedCount + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  for (const item of next) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', item.title);
    if (item.channel) {
      button.className = 'channel-card';
      button.dataset.streamId = String(item.channel.stream_id);
      const number = document.createElement('span');
      number.className = 'channel-number';
      number.textContent = item.meta ?? '•';
      const name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = item.title;
      button.appendChild(number);
      button.appendChild(name);
    } else {
      button.className = 'media-card';
      if (item.poster) {
        const poster = document.createElement('img');
        poster.className = 'media-poster';
        poster.alt = '';
        poster.src = item.poster;
        poster.setAttribute('loading', 'lazy');
        poster.addEventListener('error', () => poster.classList.add('hidden'));
        button.appendChild(poster);
      }
      const title = document.createElement('span');
      title.className = 'media-card-title';
      title.textContent = item.title;
      button.appendChild(title);
      if (item.meta) {
        const meta = document.createElement('span');
        meta.className = 'media-card-meta';
        meta.textContent = item.meta;
        button.appendChild(meta);
      }
    }
    button.addEventListener('click', item.onSelect);
    fragment.appendChild(button);
  }
  channelList.appendChild(fragment);
  renderedCount += next.length;
  moreButton.classList.toggle('hidden', renderedCount >= items.length);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = catalogView === 'live' ? 'No channels match this search or category.' : 'No titles match this search or category.';
    channelList.appendChild(empty);
  }
}

async function openSeries(item: Series): Promise<void> {
  if (!credentials) return;
  activeSeries = item;
  seriesEpisodes = [];
  updateCatalogHeading();
  categorySelect.value = 'all';
  renderChannels();
  libraryMessage.textContent = `Loading episodes for ${item.name ?? 'series'}…`;
  libraryMessage.classList.remove('hidden', 'error');
  libraryMessage.classList.add('loading');
  try {
    const response = await api<{ episodes?: Record<string, SeriesEpisode[]> }>('get_series_info', { series_id: String(item.series_id) }, 120_000);
    const episodes = response.episodes ?? {};
    for (const seasonKey of Object.keys(episodes)) {
      for (const episode of episodes[seasonKey] ?? []) {
        if (episode.season === undefined) episode.season = seasonKey;
        seriesEpisodes.push(episode);
      }
    }
    renderChannels();
    libraryMessage.textContent = seriesEpisodes.length ? `${seriesEpisodes.length} episodes` : 'No episodes were returned for this series.';
    libraryMessage.classList.remove('loading');
  } catch (error) {
    libraryMessage.textContent = error instanceof Error ? error.message : 'Could not load this series.';
    libraryMessage.classList.remove('loading');
    libraryMessage.classList.add('error');
  }
}

async function playChannel(channel: Channel): Promise<void> {
  if (!credentials) return;
  if (channel.stream_url) {
    await startPlayback(channel.name ?? 'Live TV', channel.stream_url, channel);
    return;
  }
  const ext = activeLiveFormat ?? 'ts';
  const path = ['live', credentials.username, credentials.password, `${channel.stream_id}.${ext}`]
    .map((part) => encodeURIComponent(part)).join('/');
  await startPlayback(channel.name ?? 'Live TV', `${playbackBase ?? credentials.base}/${path}`, channel);
}

async function playVod(
  title: string,
  id: number | string,
  extension: string | undefined,
  kind: 'movie' | 'series',
  options: { historyEntry?: WatchProgress; fromBeginning?: boolean } = {}
): Promise<void> {
  if (!credentials) return;
  const safeExtension = extension && /^[a-z0-9]{1,8}$/i.test(extension) ? extension : 'mp4';
  const matchingHistory = options.historyEntry ?? watchHistory.find((entry) => entry.kind === kind
    && entry.scope === watchScope
    && entry.id === String(id)
    && (kind !== 'series' || !activeSeries || entry.seriesId === String(activeSeries.series_id)));
  const movie = kind === 'movie' ? movies.find((item) => String(item.stream_id) === String(id)) : undefined;
  const episode = kind === 'series' ? seriesEpisodes.find((item) => String(item.id) === String(id)) : undefined;
  const seriesId = matchingHistory?.seriesId ?? (kind === 'series' && activeSeries ? String(activeSeries.series_id) : undefined);
  const historyKey = matchingHistory?.key ?? (kind === 'movie' ? `${watchScope}:movie:${id}` : `${watchScope}:series:${seriesId ?? 'unknown'}:${id}`);
  const historyEntry: WatchProgress = {
    key: historyKey,
    scope: watchScope,
    kind,
    id: String(id),
    title,
    extension: safeExtension,
    poster: matchingHistory?.poster ?? movie?.stream_icon ?? episode?.info?.movie_image,
    categoryId: matchingHistory?.categoryId ?? (movie?.category_id === undefined ? undefined : String(movie.category_id)),
    seriesId,
    seriesTitle: matchingHistory?.seriesTitle ?? activeSeries?.name,
    season: matchingHistory?.season ?? (episode?.season === undefined ? undefined : String(episode.season)),
    episodeNumber: matchingHistory?.episodeNumber ?? (episode?.episode_num === undefined ? undefined : String(episode.episode_num)),
    position: matchingHistory?.position ?? 0,
    duration: matchingHistory?.duration ?? 0,
    updatedAt: matchingHistory?.updatedAt ?? Date.now()
  };
  const path = [kind, credentials.username, credentials.password, `${id}.${safeExtension}`]
    .map((part) => encodeURIComponent(part)).join('/');
  await startPlayback(title, `${playbackBase ?? credentials.base}/${path}`, null, {
    entry: historyEntry,
    position: options.fromBeginning ? 0 : matchingHistory?.position ?? 0
  });
}

async function startPlayback(
  title: string,
  url: string,
  channel: Channel | null,
  resume?: { entry: WatchProgress; position: number }
): Promise<void> {
  saveWatchProgress(true);
  stopSeekHold();
  playingTitle.textContent = title;
  playerMessage.textContent = 'Connecting to stream…';
  playerLayer.classList.remove('hidden');
  seekRow.classList.add('hidden');
  updatePlayPauseControl(false);
  video.pause();
  video.removeAttribute('src');
  video.load();
  selectedChannel = channel;
  updatePlaybackControls();
  currentVodEntry = resume?.entry ?? null;
  lastProgressWrite = 0;
  video.src = url;
  if (resume && resume.position > 0) {
    const entry = resume.entry;
    video.addEventListener('loadedmetadata', () => {
      if (currentVodEntry?.key !== entry.key || !Number.isFinite(video.duration) || video.duration <= 0) return;
      try {
        video.currentTime = Math.min(resume.position, Math.max(0, video.duration - 2));
      } catch {
        // Some streams report duration but do not expose a seekable range.
      }
      updateSeekControls();
      playerMessage.textContent = `Resuming at ${playbackTime(video.currentTime)}`;
    }, { once: true });
  }
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

function seekBy(seconds: number): void {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    playerMessage.textContent = 'Seeking is not available for this live stream.';
    return;
  }
  const target = Math.max(0, Math.min(duration, video.currentTime + seconds));
  try {
    video.currentTime = target;
    seekCurrent.textContent = playbackTime(target);
    seekBar.value = String(Math.round((target / duration) * Number(seekBar.max)));
    playerMessage.textContent = `Seeking to ${playbackTime(target)}`;
  } catch {
    playerMessage.textContent = 'This stream cannot seek to that position.';
  }
}

function stopSeekHold(): void {
  if (seekHoldTimer) window.clearInterval(seekHoldTimer);
  seekHoldTimer = 0;
  seekHoldDirection = 0;
}

function beginSeekHold(direction: -1 | 1): void {
  const now = Date.now();
  if (seekHoldTimer && seekHoldDirection === direction) {
    seekHoldLastSignal = now;
    return;
  }
  stopSeekHold();
  seekHoldDirection = direction;
  seekHoldStartedAt = now;
  seekHoldLastSignal = now;
  seekBy(direction * 10);
  seekHoldTimer = window.setInterval(() => {
    const tick = Date.now();
    if (tick - seekHoldLastSignal > 450) {
      stopSeekHold();
      return;
    }
    const heldFor = tick - seekHoldStartedAt;
    const step = heldFor > 3500 ? 60 : heldFor > 2000 ? 30 : heldFor > 1000 ? 20 : 10;
    seekBy(seekHoldDirection * step);
  }, 350);
}

function closePlayer(): void {
  saveWatchProgress(true);
  stopSeekHold();
  video.pause();
  video.removeAttribute('src');
  video.load();
  playerLayer.classList.add('hidden');
  playerMessage.textContent = '';
  currentVodEntry = null;
  seekRow.classList.add('hidden');
  selectedChannel = null;
  if (!librarySection.classList.contains('hidden')) channelList.querySelector<HTMLButtonElement>('button')?.focus();
  else if (!detailView.classList.contains('hidden')) detailPlayButton.focus();
  else document.querySelector<HTMLButtonElement>(`.nav-button[data-page="${currentPage === 'detail' ? previousPage : currentPage}"]`)?.focus();
}

function switchChannel(direction: -1 | 1): void {
  if (!selectedChannel || !visibleChannels.length) return;
  const index = visibleChannels.findIndex((channel) => String(channel.stream_id) === String(selectedChannel?.stream_id));
  const nextIndex = (index + direction + visibleChannels.length) % visibleChannels.length;
  void playChannel(visibleChannels[nextIndex]);
}

function resetBackSequence(): void {
  backPressCount = 0;
  window.clearTimeout(backPressResetTimer);
  window.clearTimeout(backHintTimer);
  backHint.classList.add('hidden');
}

function closeExitPrompt(): void {
  exitConfirm.classList.add('hidden');
  resetBackSequence();
  document.querySelector<HTMLButtonElement>('.nav-button[data-page="home"]')?.focus();
}

function handleBackPress(): void {
  if (!playerLayer.classList.contains('hidden')) {
    resetBackSequence();
    closePlayer();
    return;
  }
  if (!exitConfirm.classList.contains('hidden')) {
    closeExitPrompt();
    return;
  }
  if (currentPage === 'detail') {
    showPage(previousPage);
    return;
  }
  if (currentPage !== 'home') {
    showPage('home');
    return;
  }
  backPressCount += 1;
  window.clearTimeout(backPressResetTimer);
  if (backPressCount < 3) {
    const remaining = 3 - backPressCount;
    backHint.textContent = `Press Back ${remaining === 1 ? 'once more' : `${remaining} more times`} to exit.`;
    backHint.classList.remove('hidden');
    window.clearTimeout(backHintTimer);
    backHintTimer = window.setTimeout(() => backHint.classList.add('hidden'), 1800);
    backPressResetTimer = window.setTimeout(resetBackSequence, 3500);
    return;
  }
  resetBackSequence();
  exitConfirm.classList.remove('hidden');
  $('stay-button').focus();
}

function exitApplication(): void {
  // LG documents window.close() for apps using a custom exit confirmation.
  window.close();
}

function moveDirectionalFocus(keyCode: number): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active.tagName === 'TEXTAREA' || (active === openDropdown) || active.isContentEditable) return false;
  const vertical = keyCode === 38 || keyCode === 40;
  const emptySearch = active === searchInput && !searchInput.value.trim();
  if (active.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes((active as HTMLInputElement).type)
    && !((active as HTMLInputElement).type === 'search' && (vertical || emptySearch))) return false;
  const current = active.getBoundingClientRect();
  const x = current.left + current.width / 2;
  const y = current.top + current.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const scope: ParentNode = !playerLayer.classList.contains('hidden') ? playerLayer
    : exitConfirm.classList.contains('hidden') ? document : exitConfirm;
  const candidates = scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])');
  for (const candidate of Array.from(candidates)) {
    if (candidate === active || candidate === openDropdown || candidate.closest('.hidden')) continue;
    const rect = candidate.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const dx = rect.left + rect.width / 2 - x;
    const dy = rect.top + rect.height / 2 - y;
    const primary = keyCode === 37 ? -dx : keyCode === 39 ? dx : keyCode === 38 ? -dy : dy;
    if (primary <= 0) continue;
    const secondary = keyCode === 37 || keyCode === 39 ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 1.6;
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  if (!best && vertical) {
    const ordered = Array.from(candidates).filter((candidate) => !candidate.closest('.hidden')
      && candidate.getBoundingClientRect().width > 0 && candidate.getBoundingClientRect().height > 0);
    const activeIndex = ordered.indexOf(active);
    const nextIndex = activeIndex + (keyCode === 38 ? -1 : 1);
    if (activeIndex >= 0 && nextIndex >= 0 && nextIndex < ordered.length) best = ordered[nextIndex];
  }
  if (!best) return false;
  best.focus();
  return true;
}

function disconnect(): void {
  closePlayer();
  requestController?.abort();
  credentials = null;
  playbackBase = null;
  activeLiveFormat = null;
  categories = [];
  channels = [];
  movieCategories = [];
  movies = [];
  seriesCategories = [];
  series = [];
  seriesEpisodes = [];
  activeSeries = null;
  catalogView = 'live';
  catalogTypeSelect.value = 'live';
  searchInput.value = '';
  visibleChannels = [];
  renderedCount = 0;
  clearChildren(categorySelect);
  categorySelect.appendChild(new Option('All categories', 'all'));
  clearChildren(channelList);
  librarySection.classList.add('hidden');
  appLayout.classList.add('hidden');
  setupSection.classList.remove('hidden');
  stateLabel.textContent = 'Not connected';
  const saved = rememberProviderInput.checked ? readSavedProvider() : null;
  serverInput.value = saved?.base ?? '';
  usernameInput.value = saved?.username ?? '';
  passwordInput.value = saved?.password ?? '';
  if (saved) {
    formatInput.value = saved.format;
    providerTypeSelect.value = saved.kind ?? 'xtream';
  }
  updateSourceTypeControls();
  setMessage(saved ? 'Disconnected. Your saved login remains on this TV.' : 'Disconnected. Session credentials were cleared.');
  serverInput.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadProvider();
});
saveProviderButton.addEventListener('click', saveCurrentProvider);
providerTypeSelect.addEventListener('change', updateSourceTypeControls);
catalogTypeSelect.addEventListener('change', () => {
  catalogView = catalogTypeSelect.value as CatalogView;
  activeSeries = null;
  seriesEpisodes = [];
  searchInput.value = '';
  updateCatalogHeading();
  renderChannels();
});
searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => renderChannels(), 180);
});
categorySelect.addEventListener('change', () => renderChannels());
backToSeriesButton.addEventListener('click', () => {
  activeSeries = null;
  seriesEpisodes = [];
  updateCatalogHeading();
  renderChannels();
});
moreButton.addEventListener('click', () => renderChannels(true));
document.querySelectorAll<HTMLButtonElement>('.nav-button').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page as AppPage));
});
$('sidebar-toggle').addEventListener('click', () => {
  const collapsed = sidebar.classList.toggle('collapsed');
  try { localStorage.setItem('nextflix.sidebar-collapsed.v1', String(collapsed)); } catch { /* Session-only preference. */ }
});
heroBrowseButton.addEventListener('click', () => showPage('movies'));
heroPlayButton.addEventListener('click', () => {
  if (!featuredItem) return;
  if (featuredItem.kind === 'movie') playVod(featuredItem.item.name ?? 'Movie', featuredItem.item.stream_id, featuredItem.item.container_extension, 'movie');
  else showSeriesDetails(featuredItem.item);
});
$('detail-back').addEventListener('click', () => showPage(previousPage));
detailPlayButton.addEventListener('click', () => {
  if (!detailItem) return;
  if (detailItem.kind === 'movie') playVod(detailItem.item.name ?? 'Movie', detailItem.item.stream_id, detailItem.item.container_extension, 'movie');
  else {
    const item = detailItem.item;
    showPage('series');
    void openSeries(item);
  }
});
detailStartOverButton.addEventListener('click', () => {
  if (detailItem?.kind === 'movie') {
    const item = detailItem.item;
    void playVod(item.name ?? 'Movie', item.stream_id, item.container_extension, 'movie', { fromBeginning: true });
  }
});
detailListButton.addEventListener('click', () => {
  if (detailItem?.kind === 'movie') toggleFavorite('movie', detailItem.item.stream_id);
  else if (detailItem?.kind === 'series') toggleFavorite('series', detailItem.item.series_id);
});
settingsCategoryType.addEventListener('change', () => {
  renderLanguageFilter();
  renderCategorySettings();
});
$('show-all-categories').addEventListener('click', () => {
  const view = settingsCategoryType.value as CatalogView;
  const language = activeLanguageFilters[view];
  for (const category of categoriesFor(view)) {
    if (category.category_id === undefined || (language !== 'all' && categoryLanguageTag(category.category_name).toUpperCase() !== language)) continue;
    hiddenCategoryIds[view].delete(String(category.category_id));
  }
  saveHiddenCategories();
  renderCategorySettings();
  updateCatalogHeading();
  renderChannels();
  renderHome();
});
$('hide-all-categories').addEventListener('click', () => {
  const view = settingsCategoryType.value as CatalogView;
  const language = activeLanguageFilters[view];
  for (const category of categoriesFor(view)) {
    if (category.category_id === undefined || (language !== 'all' && categoryLanguageTag(category.category_name).toUpperCase() !== language)) continue;
    hiddenCategoryIds[view].add(String(category.category_id));
  }
  saveHiddenCategories();
  renderCategorySettings();
  updateCatalogHeading();
  renderChannels();
  renderHome();
});
$('disconnect-button').addEventListener('click', disconnect);
$('close-player').addEventListener('click', closePlayer);
previousChannelButton.addEventListener('click', () => switchChannel(-1));
nextChannelButton.addEventListener('click', () => switchChannel(1));
seekBackButton.addEventListener('click', () => seekBy(-10));
seekForwardButton.addEventListener('click', () => seekBy(10));
playPauseButton.addEventListener('click', () => {
  if (video.paused) void video.play().catch(() => { playerMessage.textContent = 'Playback could not resume.'; });
  else { video.pause(); saveWatchProgress(true); }
});
seekBar.addEventListener('input', () => {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try { video.currentTime = (Number(seekBar.value) / Number(seekBar.max)) * duration; } catch { /* The stream may not expose a seekable range. */ }
});
video.addEventListener('loadedmetadata', updateSeekControls);
video.addEventListener('durationchange', updateSeekControls);
video.addEventListener('timeupdate', () => {
  updateSeekControls();
  saveWatchProgress();
});
video.addEventListener('playing', () => { playerMessage.textContent = ''; updatePlayPauseControl(true); });
video.addEventListener('pause', () => updatePlayPauseControl(false));
video.addEventListener('ended', () => {
  saveWatchProgress(true, true);
  playerMessage.textContent = 'Playback finished.';
});
video.addEventListener('seeked', updateSeekControls);
video.addEventListener('waiting', () => { playerMessage.textContent = 'Buffering…'; });
video.addEventListener('error', () => {
  if (!playerLayer.classList.contains('hidden')) playerMessage.textContent = describePlaybackFailure();
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const isArrow = [37, 38, 39, 40].includes(event.keyCode);
  if (target instanceof HTMLSelectElement) {
    if (event.keyCode === 13 || event.keyCode === 23 || event.key === ' ' || event.key === 'Enter') {
      openDropdown = openDropdown === target ? null : target;
      return;
    }
    if (isArrow) {
      if (openDropdown === target && (event.keyCode === 38 || event.keyCode === 40)) return;
      if (openDropdown === target) openDropdown = null;
      event.preventDefault();
      moveDirectionalFocus(event.keyCode);
      return;
    }
  }
  const isSearchVertical = target === searchInput && (event.keyCode === 38 || event.keyCode === 40);
  const isEmptySearchNavigation = target === searchInput && !searchInput.value.trim();
  const isTextEntry = !!target && ((target.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((target as HTMLInputElement).type))
    || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
  if (isArrow && playerLayer.classList.contains('hidden')) {
    if ((!isTextEntry || isSearchVertical || isEmptySearchNavigation) && moveDirectionalFocus(event.keyCode)) { event.preventDefault(); return; }
    if (isSearchVertical) { event.preventDefault(); return; }
    if (isEmptySearchNavigation) { event.preventDefault(); return; }
    if (!isTextEntry && currentPage === 'settings') { event.preventDefault(); return; }
  }
  const isBack = event.keyCode === 461 || event.keyCode === 10009 || event.key === 'Escape' || (event.key === 'Backspace' && !isTextEntry);
  if (isBack) {
    event.preventDefault();
    handleBackPress();
    return;
  }
  if (playerLayer.classList.contains('hidden')) return;
  if ([37, 38, 39, 40].includes(event.keyCode)) {
    if ((event.keyCode === 37 || event.keyCode === 39) && target !== seekBar) {
      event.preventDefault();
      beginSeekHold(event.keyCode === 37 ? -1 : 1);
      return;
    }
    if (event.keyCode === 38 || event.keyCode === 40) {
      if (moveDirectionalFocus(event.keyCode)) event.preventDefault();
      else event.preventDefault();
      return;
    }
  }
  if (event.keyCode === 427 || event.keyCode === 33) {
    event.preventDefault();
    switchChannel(1);
  } else if (event.keyCode === 428 || event.keyCode === 34) {
    event.preventDefault();
    switchChannel(-1);
  } else if (event.keyCode === 10252 || event.keyCode === 179 || event.keyCode === 415 || event.keyCode === 19) {
    event.preventDefault();
    if (video.paused) void video.play().catch(() => { playerMessage.textContent = 'Playback could not resume.'; });
    else { video.pause(); saveWatchProgress(true); }
  }
});

document.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
  select.addEventListener('click', (event) => { if (event.detail > 0) openDropdown = select; });
  select.addEventListener('blur', () => { if (openDropdown === select) openDropdown = null; });
});

window.addEventListener('keyup', (event) => {
  if (event.keyCode === 37 || event.keyCode === 39) stopSeekHold();
});

$('stay-button').addEventListener('click', closeExitPrompt);
$('exit-button').addEventListener('click', exitApplication);

try {
  const savedFavorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
  if (Array.isArray(savedFavorites)) favorites = new Set(savedFavorites.map(String));
  sidebar.classList.toggle('collapsed', localStorage.getItem('nextflix.sidebar-collapsed.v1') === 'true');
} catch { /* Defaults are used when local storage is unavailable. */ }
loadWatchHistory();

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
  providerTypeSelect.value = savedProvider.kind ?? 'xtream';
  updateSourceTypeControls();
  setMessage('Reconnecting with the login saved on this TV…');
  window.setTimeout(() => { void loadProvider({ startup: true }); }, 300);
}

