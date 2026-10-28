import './style.css';
import './platform/webOSTV.js';
import {
  readCatalog,
  writeCatalog,
  pruneRebuildableCaches,
  getRebuildableCacheCounts,
  clearRebuildableCaches,
  type CachedCatalog,
  type CatalogCategory as Category,
  type CatalogChannel as Channel,
  type CatalogMovie as Movie,
  type CatalogSeries as Series,
  type SeriesEpisode
} from './catalogCache';
import { decryptBackup, encryptBackup, type BackupPayload } from './backup';
import { findOmdbMetadata } from './metadata';
import { searchOnlineSubtitles, downloadOnlineSubtitle, type OnlineSubtitle } from './opensubtitles';
import { WebOsMediaSubtitleAdapter, type WebOsSubtitleTrack } from './platform/webos-media';

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
const homeRecommended = $('home-recommended');
const recommendedRow = $('recommended-row');
const homeContinue = $('home-continue');
const activeProfileLabel = $('active-profile-name');
const profileSwitchButton = $('profile-switch') as HTMLButtonElement;
const profileDialog = $('profiles-dialog');
const profileList = $('profiles-list');
const profileNameInput = $('profile-name') as HTMLInputElement;
const profileMessage = $('profile-message');
const continueRow = $('continue-row');
const languageFilter = $('language-filter');
const languageSelect = $('language-select') as HTMLSelectElement;
const detailPoster = $('detail-poster') as HTMLImageElement;
const detailKind = $('detail-kind');
const detailTitle = $('detail-title');
const detailMeta = $('detail-meta');
const detailDescription = $('detail-description');
const detailCast = $('detail-cast');
const detailSource = $('detail-source');
const detailPlayButton = $('detail-play') as HTMLButtonElement;
const detailListButton = $('detail-list') as HTMLButtonElement;
const detailStartOverButton = $('detail-start-over') as HTMLButtonElement;
const settingsCategoryType = $('settings-category-type') as HTMLSelectElement;
const categoryVisibilityList = $('category-visibility-list');
const categorySelect = $('category') as HTMLSelectElement;
const channelList = $('channel-list');
const channelListScroll = $('channel-list-scroll');
const appContent = document.querySelector<HTMLElement>('.app-content')!;
const scrollCueLayer = document.getElementById('scroll-cues');
const catalogTitle = $('catalog-title');
const searchInput = $('catalog-search') as HTMLInputElement;
const backToSeriesButton = $('back-to-series') as HTMLButtonElement;
const moreButton = $('more-button') as HTMLButtonElement;
const pagination = $('catalog-pagination');
const previousPageButton = $('page-previous') as HTMLButtonElement;
const nextPageButton = $('page-next') as HTMLButtonElement;
const pageIndicator = $('page-indicator');
const libraryMessage = $('library-message');
const livePreview = $('live-preview');
const livePreviewTitle = $('live-preview-title');
const livePreviewMessage = $('live-preview-message');
const playerLayer = $('player');
const backupPasswordInput = $('backup-password') as HTMLInputElement;
const backupFileInput = $('backup-file') as HTMLInputElement;
const backupStatus = $('backup-status');
const diagnosticsSummary = $('diagnostics-summary');
const cacheStatus = $('cache-status');
const updateStatus = $('update-status');
const releaseLink = $('release-link') as HTMLAnchorElement;
const omdbKeyInput = $('omdb-api-key') as HTMLInputElement;
const opensubtitlesKeyInput = $('opensubtitles-key') as HTMLInputElement;
const metadataSettingsStatus = $('metadata-settings-status');
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
const subtitleLanguagePreferencesInput = $('subtitle-language-preferences') as HTMLSelectElement;
const subtitleTracksButton = $('subtitle-tracks') as HTMLButtonElement;
const trackMenu = $('track-menu');
const trackMenuTitle = $('track-menu-title');
const trackOptions = $('track-options');
const nextEpisodePrompt = $('next-episode-prompt');
const nextEpisodeCountdown = $('next-episode-countdown');
const nextEpisodePlayButton = $('next-episode-play') as HTMLButtonElement;
const nextEpisodeCancelButton = $('next-episode-cancel') as HTMLButtonElement;

const PAGE_SIZE = 20;
const LIVE_BATCH_SIZE = 72;
const CATALOG_REFRESH_MS = 24 * 60 * 60 * 1000;
const REMEMBERED_PROVIDER_KEY = 'nextflix.xtream.provider.v1';
const APP_VERSION = '0.6.5';
const versionLabel = $('app-version');
versionLabel.textContent = `NextFlix ${APP_VERSION}`;
type SavedProvider = { base: string; username: string; password: string; format: LiveFormat; kind?: 'xtream' | 'm3u' };
let credentials: { base: string; username: string; password: string } | null = null;
let playbackBase: string | null = null;
let watchScope = 'default';
let catalogCacheKey = '';
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
type ViewerProfile = { id: string; name: string };
const PROFILES_KEY = 'nextflix.profiles.v1';
const ACTIVE_PROFILE_KEY = 'nextflix.active-profile.v1';
let profiles: ViewerProfile[] = [{ id: 'default', name: 'Default' }];
let activeProfileId = 'default';
const FAVORITES_KEY = 'nextflix.my-list.v1';
const WATCH_HISTORY_KEY = 'nextflix.watch-history.v1';
const TRACK_PREFERENCES_KEY = 'nextflix.track-preferences.v1';
const OMDB_API_KEY = 'nextflix.omdb-api-key.v1';
const OPENSUBTITLES_KEY = 'nextflix.opensubtitles-key.v1';
let omdbApiKey = '';
let opensubtitlesKey = '';
let onlineSubtitleChoices: OnlineSubtitle[] = [];
let onlineSubtitleLoading = false;
let externalSubtitleElement: HTMLTrackElement | null = null;
let externalSubtitleUrl = '';
let playbackGeneration = 0;
type MediaTrack = { language?: string; label?: string; kind?: string; enabled?: boolean; mode?: string };
type SubtitleTrackChoice = { source: 'html' | 'webos'; index: number; track?: MediaTrack; language?: string; label: string };
type TrackList = { length: number; [index: number]: MediaTrack; addEventListener?: (type: string, listener: EventListener) => void };
type DropdownControl = { select: HTMLSelectElement; wrapper: HTMLDivElement; trigger: HTMLButtonElement; list: HTMLDivElement; originalValue: string };
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
  genre?: string;
};
let watchHistory: WatchProgress[] = [];
let currentVodEntry: WatchProgress | null = null;
let lastProgressWrite = 0;
let searchTimer = 0;
let sourceType: 'xtream' | 'm3u' = 'xtream';
let visibleChannels: Channel[] = [];
let renderedCount = 0;
let catalogPages: Record<'movies' | 'series', number> = { movies: 1, series: 1 };
let catalogTotalPages = 1;
let selectedChannel: Channel | null = null;
let returnToLivePreviewOnPlayerClose = false;
let requestController: AbortController | null = null;
let backPressCount = 0;
let backPressResetTimer = 0;
let backHintTimer = 0;
let seekHoldTimer = 0;
let seekHoldDirection: -1 | 1 | 0 = 0;
let seekHoldStartedAt = 0;
let seekHoldLastSignal = 0;
let playerControlsHideTimer = 0;
let activeDropdown: DropdownControl | null = null;
let focusedDropdownOption = 0;
let editingInput: HTMLInputElement | null = null;
const inputProxies = new Map<HTMLInputElement, HTMLButtonElement>();
const dropdownControls = new Map<HTMLSelectElement, DropdownControl>();
let preferredSubtitleLanguages = ['nl'];
let manualSubtitleTrack: SubtitleTrackChoice | null | 'off' = null;
let openTrackMenu = false;
const webOsSubtitleAdapter = new WebOsMediaSubtitleAdapter();
let episodeCountdownTimer = 0;
let nextEpisode: SeriesEpisode | null = null;
const observedTrackLists = new WeakSet<object>();

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
  // Hidden native inputs must not trigger browser validation/focus; loadProvider
  // performs the same checks explicitly before making a request.
  usernameInput.required = !playlist && !inputProxies.has(usernameInput);
  passwordInput.required = !playlist && !inputProxies.has(passwordInput);
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
  let pending: { title?: string; logo?: string; group?: string } | null = null;
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

type ScrollCueSet = { element: HTMLElement; up: HTMLSpanElement; down: HTMLSpanElement; left: HTMLSpanElement; right: HTMLSpanElement };
const scrollCueSets = new Map<HTMLElement, ScrollCueSet>();
let scrollCueFrame = 0;

function scheduleScrollCueUpdate(): void {
  if (scrollCueFrame) return;
  scrollCueFrame = window.requestAnimationFrame(() => {
    scrollCueFrame = 0;
    updateScrollCues();
  });
}

function updateScrollCues(): void {
  if (!scrollCueLayer) return;
  const selector = 'main, .panel, .app-content, .poster-row, .channel-list-scroll, .dropdown-options, .track-menu, .profiles-dialog, .profiles-list';
  const scrollTargets = document.querySelectorAll<HTMLElement>(selector);
  const active = new Set(scrollTargets);
  for (const [element, cues] of scrollCueSets) {
    if (!element.isConnected || !active.has(element)) {
      [cues.up, cues.down, cues.left, cues.right].forEach((cue) => cue.remove());
      scrollCueSets.delete(element);
    }
  }
  const makeCue = (direction: 'up' | 'down' | 'left' | 'right'): HTMLSpanElement => {
    const cue = document.createElement('span');
    cue.className = `scroll-cue scroll-cue-${direction}`;
    cue.setAttribute('aria-hidden', 'true');
    scrollCueLayer.appendChild(cue);
    return cue;
  };
  for (const element of scrollTargets) {
    let cues = scrollCueSets.get(element);
    if (!cues) {
      cues = { element, up: makeCue('up'), down: makeCue('down'), left: makeCue('left'), right: makeCue('right') };
      scrollCueSets.set(element, cues);
    }
    const rect = element.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
      && rect.left < window.innerWidth && rect.top < window.innerHeight && getComputedStyle(element).visibility !== 'hidden';
    const canUp = visible && element.scrollTop > 1;
    const canDown = visible && element.scrollTop + element.clientHeight < element.scrollHeight - 2;
    const canLeft = visible && element.scrollLeft > 1;
    const canRight = visible && element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
    const place = (cue: HTMLElement, shown: boolean, x: number, y: number): void => {
      cue.hidden = !shown;
      if (!shown) return;
      cue.style.left = `${Math.max(0, Math.min(window.innerWidth - 32, x))}px`;
      cue.style.top = `${Math.max(0, Math.min(window.innerHeight - 32, y))}px`;
    };
    place(cues.up, canUp, rect.left + rect.width / 2 - 16, rect.top + 3);
    place(cues.down, canDown, rect.left + rect.width / 2 - 16, rect.bottom - 35);
    place(cues.left, canLeft, rect.left + 3, rect.top + rect.height / 2 - 16);
    place(cues.right, canRight, rect.right - 35, rect.top + rect.height / 2 - 16);
  }
}

function installScrollCues(): void {
  scheduleScrollCueUpdate();
  document.addEventListener('scroll', scheduleScrollCueUpdate, true);
  window.addEventListener('resize', scheduleScrollCueUpdate);
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !scrollCueLayer?.contains(record.target))) scheduleScrollCueUpdate();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
}

function syncDropdown(control: DropdownControl): void {
  const selected = Array.from(control.select.options).find((option) => option.value === control.select.value);
  control.trigger.textContent = selected?.textContent ?? '';
  control.trigger.setAttribute('aria-label', `${control.select.closest('label')?.firstChild?.textContent?.trim() ?? 'Choose'}: ${control.trigger.textContent}`);
}

function syncAllDropdowns(): void {
  dropdownControls.forEach(syncDropdown);
}

function closeDropdownSelection(commit: boolean): void {
  if (!activeDropdown) return;
  const control = activeDropdown;
  if (!commit) control.select.value = control.originalValue;
  activeDropdown = null;
  control.list.classList.add('hidden');
  control.trigger.setAttribute('aria-expanded', 'false');
  syncDropdown(control);
  control.trigger.focus();
}

function commitDropdownValue(control: DropdownControl, value: string): void {
  control.select.value = value;
  closeDropdownSelection(true);
  control.select.dispatchEvent(new Event('change', { bubbles: true }));
}

function openDropdownSelection(control: DropdownControl): void {
  if (activeDropdown) closeDropdownSelection(false);
  control.originalValue = control.select.value;
  focusedDropdownOption = Math.max(0, Array.from(control.select.options).findIndex((option) => option.value === control.select.value));
  clearChildren(control.list);
  Array.from(control.select.options).forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dropdown-option${index === focusedDropdownOption ? ' selected' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(option.value === control.select.value));
    button.dataset.value = option.value;
    button.textContent = option.textContent ?? option.value;
    button.addEventListener('click', () => commitDropdownValue(control, option.value));
    control.list.appendChild(button);
  });
  activeDropdown = control;
  control.trigger.setAttribute('aria-expanded', 'true');
  control.list.classList.remove('hidden');
  control.list.querySelectorAll<HTMLButtonElement>('.dropdown-option')[focusedDropdownOption]?.focus();
}

function moveDropdownHighlight(direction: -1 | 1): void {
  if (!activeDropdown) return;
  const options = activeDropdown.list.querySelectorAll<HTMLButtonElement>('.dropdown-option');
  if (!options.length) return;
  focusedDropdownOption = Math.max(0, Math.min(options.length - 1, focusedDropdownOption + direction));
  options.forEach((option, index) => option.classList.toggle('selected', index === focusedDropdownOption));
  options[focusedDropdownOption].focus();
}

function setupDropdowns(): void {
  document.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-control';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.className = 'dropdown-options hidden';
    list.setAttribute('role', 'listbox');
    const control: DropdownControl = { select, wrapper, trigger, list, originalValue: select.value };
    dropdownControls.set(select, control);
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    select.parentElement?.insertBefore(wrapper, select);
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    trigger.addEventListener('click', () => {
      if (activeDropdown === control) closeDropdownSelection(false);
      else openDropdownSelection(control);
    });
    syncDropdown(control);
  });
}

function focusDropdownTrigger(select: HTMLSelectElement): void {
  dropdownControls.get(select)?.trigger.focus();
}

function updateInputProxy(input: HTMLInputElement): void {
  const proxy = inputProxies.get(input);
  if (!proxy) return;
  proxy.textContent = input.type === 'password' && input.value
    ? '•'.repeat(Math.min(input.value.length, 24))
    : input.value || input.placeholder || '';
  proxy.classList.toggle('placeholder', !input.value && !!input.placeholder);
}

function focusInputProxy(input: HTMLInputElement): void {
  inputProxies.get(input)?.focus();
}

function beginInputEditing(input: HTMLInputElement): void {
  if (editingInput) endInputEditing();
  const proxy = inputProxies.get(input);
  if (!proxy) return;
  editingInput = input;
  input.hidden = false;
  input.readOnly = false;
  input.tabIndex = 0;
  proxy.hidden = true;
  input.focus();
}

function endInputEditing(): void {
  if (!editingInput) return;
  const input = editingInput;
  const proxy = inputProxies.get(input);
  updateInputProxy(input);
  editingInput = null;
  input.blur();
  input.readOnly = true;
  input.tabIndex = -1;
  input.hidden = true;
  if (proxy) {
    proxy.hidden = false;
    proxy.focus();
  }
}

function setupInputProxies(): void {
  document.querySelectorAll<HTMLInputElement>(
    'input:not([type]), input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="color"]):not([type="image"]):not([type="hidden"])'
  )
    .forEach((input) => {
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'input-proxy';
      const labelText = input.closest('label')?.textContent?.replace(input.value, '').trim();
      proxy.setAttribute('aria-label', labelText || input.placeholder || 'Text field');
      input.parentElement?.insertBefore(proxy, input);
      input.hidden = true;
      input.readOnly = true;
      input.tabIndex = -1;
      input.required = false;
      inputProxies.set(input, proxy);
      updateInputProxy(input);
      input.addEventListener('input', () => updateInputProxy(input));
      input.addEventListener('change', () => updateInputProxy(input));
      proxy.addEventListener('click', () => beginInputEditing(input));
    });
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
  const visible = currentPage === 'settings' || currentPage === 'movies' || currentPage === 'series'
    || currentPage === 'live' || currentPage === 'search';
  languageFilter.classList.toggle('hidden', !visible);
  if (!visible) return;
  const view = selectedLanguageView();
  const available = languagesForView(view);
  if (activeLanguageFilters[view] !== 'all' && available.indexOf(activeLanguageFilters[view]) < 0) {
    activeLanguageFilters[view] = 'all';
  }
  clearChildren(languageSelect);
  languageSelect.appendChild(new Option('All languages', 'all'));
  for (const label of available) languageSelect.appendChild(new Option(label, label.toUpperCase()));
  languageSelect.value = activeLanguageFilters[view];
  const control = dropdownControls.get(languageSelect);
  if (control) syncDropdown(control);
}

function applyLanguageFilter(): void {
  const view = selectedLanguageView();
  activeLanguageFilters[view] = languageSelect.value;
  try { localStorage.setItem(languageFilterKey, JSON.stringify(activeLanguageFilters)); } catch { /* Session-only filter selection. */ }
  if (view === 'movies' || view === 'series') catalogPages[view] = 1;
  if (currentPage === 'settings') {
    renderCategorySettings();
  } else {
    categorySelect.value = 'all';
    updateCatalogHeading();
    renderChannels();
  }
  focusDropdownTrigger(languageSelect);
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
        .sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 320)
      : [];
  } catch {
    watchHistory = [];
  }
}

function persistWatchHistory(): void {
  try { localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(watchHistory)); } catch { /* Resume data stays in memory if storage is full. */ }
}

function migrateLegacyWatchHistory(cacheKey: string): void {
  if (activeProfileId !== 'default') return;
  const legacyProviderScope = m3uCatalogKey(cacheKey);
  const targetScope = profileScopeForCatalog(cacheKey, activeProfileId);
  let changed = false;
  for (const entry of watchHistory) {
    if (entry.scope === 'default' || entry.scope === legacyProviderScope) {
      const previousScope = entry.scope;
      entry.scope = targetScope;
      entry.key = entry.key.startsWith(`${previousScope}:`)
        ? `${targetScope}${entry.key.slice(previousScope.length)}`
        : `${targetScope}:${entry.key}`;
      changed = true;
    }
  }
  if (changed) persistWatchHistory();
}

function profileStorageKey(baseKey: string, profileId = activeProfileId): string {
  return `${baseKey}.${profileId}`;
}

function profileScopeForCatalog(cacheKey: string, profileId = activeProfileId): string {
  return `${profileId}:${m3uCatalogKey(cacheKey)}`;
}

function initializeProfiles(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? 'null') as unknown;
    if (Array.isArray(saved)) {
      const valid = (saved as ViewerProfile[]).filter((profile) => profile && typeof profile.id === 'string'
        && typeof profile.name === 'string' && profile.id && profile.name.trim()).slice(0, 8)
        .map((profile) => ({ id: profile.id, name: profile.name.trim().slice(0, 24) }));
      if (valid.length) profiles = valid;
    }
    const active = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (active && profiles.some((profile) => profile.id === active)) activeProfileId = active;
  } catch { /* Keep the single local Default profile when storage is unavailable. */ }
  activeProfileLabel.textContent = profiles.find((profile) => profile.id === activeProfileId)?.name ?? 'Default';
}

function saveProfiles(): void {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* Existing profiles remain available for this session. */ }
}

function loadFavoritesForProfile(migrateLegacy = false): void {
  try {
    const saved = localStorage.getItem(profileStorageKey(FAVORITES_KEY));
    if (saved !== null) {
      const parsed = JSON.parse(saved) as unknown;
      favorites = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
      return;
    }
    if (migrateLegacy && activeProfileId === 'default') {
      const legacy = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
      favorites = new Set(Array.isArray(legacy) ? legacy.map(String) : []);
      localStorage.setItem(profileStorageKey(FAVORITES_KEY), JSON.stringify(Array.from(favorites)));
      return;
    }
  } catch { /* Fall back to an empty in-memory list if local storage is unavailable. */ }
  favorites = new Set();
}

function loadTrackPreferencesForProfile(profileId = activeProfileId): void {
  preferredSubtitleLanguages = ['nl'];
  try {
    const saved = localStorage.getItem(profileStorageKey(TRACK_PREFERENCES_KEY, profileId))
      ?? (profileId === 'default' ? localStorage.getItem(TRACK_PREFERENCES_KEY) : null);
    const preferences = JSON.parse(saved ?? 'null') as { subtitles?: unknown } | null;
    if (Array.isArray(preferences?.subtitles)) {
      preferredSubtitleLanguages = preferences.subtitles.map(String).filter(Boolean).slice(0, 1);
    }
  } catch { /* Use the built-in subtitle preference for new profiles. */ }
  subtitleLanguagePreferencesInput.value = preferredSubtitleLanguages[0] ?? '';
}

function renderProfileOptions(): void {
  clearChildren(profileList);
  for (const profile of profiles) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `profile-option${profile.id === activeProfileId ? ' active' : ''}`;
    button.textContent = `${profile.name}${profile.id === activeProfileId ? ' · Current' : ''}`;
    button.setAttribute('aria-pressed', String(profile.id === activeProfileId));
    button.addEventListener('click', () => switchProfile(profile.id));
    profileList.appendChild(button);
  }
}

function openProfilesDialog(): void {
  renderProfileOptions();
  profileMessage.textContent = '';
  profileNameInput.value = '';
  updateInputProxy(profileNameInput);
  profileDialog.classList.remove('hidden');
  profileList.querySelector<HTMLButtonElement>('.profile-option.active')?.focus();
}

function closeProfilesDialog(): void {
  profileDialog.classList.add('hidden');
  profileSwitchButton.focus();
}

function switchProfile(profileId: string): void {
  const profile = profiles.find((entry) => entry.id === profileId);
  if (!profile) return;
  activeProfileId = profile.id;
  activeProfileLabel.textContent = profile.name;
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id); } catch { /* Current profile remains active for this session. */ }
  watchScope = catalogCacheKey ? profileScopeForCatalog(catalogCacheKey, profile.id) : profile.id;
  loadFavoritesForProfile();
  loadTrackPreferencesForProfile(profile.id);
  renderProfileOptions();
  renderContinueWatching();
  renderHome();
  renderMyList();
  if (detailItem?.kind === 'movie') {
    detailListButton.textContent = favorites.has(favoriteKey('movie', detailItem.item.stream_id)) ? 'Remove from My List' : 'Add to My List';
  } else if (detailItem?.kind === 'series') {
    detailListButton.textContent = favorites.has(favoriteKey('series', detailItem.item.series_id)) ? 'Remove from My List' : 'Add to My List';
  }
  profileDialog.classList.add('hidden');
  profileSwitchButton.focus();
}

function addViewerProfile(): void {
  const name = profileNameInput.value.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) {
    profileMessage.textContent = 'Enter a name for the new profile.';
    focusInputProxy(profileNameInput);
    return;
  }
  if (profiles.length >= 8) {
    profileMessage.textContent = 'You can create up to eight profiles on this TV.';
    return;
  }
  if (profiles.some((profile) => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    profileMessage.textContent = 'A profile with that name already exists.';
    focusInputProxy(profileNameInput);
    return;
  }
  const profile = { id: `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name };
  profiles.push(profile);
  saveProfiles();
  switchProfile(profile.id);
}

function collectSettingsBackup(): BackupPayload {
  const values: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('nextflix.')) {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
  }
  return { format: 'nextflix-settings', schemaVersion: 1, createdAt: new Date().toISOString(), values };
}

async function exportSettingsBackup(): Promise<void> {
  backupStatus.textContent = 'Encrypting backup on this device…';
  try {
    const payload = collectSettingsBackup();
    const blob = await encryptBackup(payload, backupPasswordInput.value);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nextflix-backup-${new Date().toISOString().slice(0, 10)}.nextflix`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    backupStatus.textContent = `Encrypted backup created (${Object.keys(payload.values).length} settings). Store the file and password separately.`;
    backupPasswordInput.value = '';
    updateInputProxy(backupPasswordInput);
  } catch (error) {
    backupStatus.textContent = error instanceof Error ? error.message : 'Could not create the encrypted backup.';
  }
}

function replaceSettingsFromBackup(values: Record<string, string>): void {
  const previous: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('nextflix.')) {
      const value = localStorage.getItem(key);
      if (value !== null) previous[key] = value;
    }
  }
  const clearNextFlixSettings = (): void => {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('nextflix.')) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  };
  try {
    clearNextFlixSettings();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  } catch (error) {
    try {
      clearNextFlixSettings();
      Object.entries(previous).forEach(([key, value]) => localStorage.setItem(key, value));
    } catch { /* Preserve the original storage error; rollback is best-effort if quota is exhausted. */ }
    throw error;
  }
}

async function restoreSettingsBackup(file: File): Promise<void> {
  backupStatus.textContent = 'Checking and decrypting the selected backup…';
  try {
    const payload = await decryptBackup(file, backupPasswordInput.value);
    const count = Object.keys(payload.values).length;
    const created = new Date(payload.createdAt);
    const dateLabel = Number.isNaN(created.getTime()) ? 'an unknown date' : created.toLocaleString();
    if (!window.confirm(`Restore ${count} NextFlix settings from ${dateLabel}? This replaces the settings currently saved in NextFlix. Cached catalogs are not affected.`)) {
      backupStatus.textContent = 'Restore cancelled. Your current settings are unchanged.';
      return;
    }
    replaceSettingsFromBackup(payload.values);
    backupStatus.textContent = 'Backup restored. NextFlix will reload to apply the saved profiles and provider settings.';
    window.setTimeout(() => window.location.reload(), 900);
  } catch (error) {
    backupStatus.textContent = error instanceof Error ? error.message : 'Could not restore this backup.';
  } finally {
    backupFileInput.value = '';
    backupPasswordInput.value = '';
    updateInputProxy(backupPasswordInput);
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function refreshDiagnostics(): Promise<void> {
  diagnosticsSummary.textContent = 'Reading local app and cache diagnostics…';
  try {
    const cacheCounts = await getRebuildableCacheCounts();
    let localBytes = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) ?? '';
      localBytes += key.length * 2 + (localStorage.getItem(key)?.length ?? 0) * 2;
    }
    const storageManager = (navigator as Navigator & { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> } }).storage;
    let quotaText = 'not reported by this browser';
    if (storageManager?.estimate) {
      try {
        const estimate = await storageManager.estimate();
        if (typeof estimate.usage === 'number' && typeof estimate.quota === 'number') {
          quotaText = `${formatBytes(estimate.usage)} used of ${formatBytes(estimate.quota)}`;
        }
      } catch { /* Storage quota reporting is optional on older webOS browsers. */ }
    }
    const media = document.createElement('video');
    const report = [
      `NextFlix ${APP_VERSION} · ${navigator.userAgent}`,
      `Connection: ${stateLabel.textContent || (navigator.onLine ? 'Online' : 'Offline')}`,
      `Catalog currently loaded: ${channels.length.toLocaleString()} live · ${movies.length.toLocaleString()} movies · ${series.length.toLocaleString()} series`,
      `Rebuildable IndexedDB cache: ${cacheCounts.catalogs} catalog snapshots`,
      `Local settings size: approximately ${formatBytes(localBytes)} · browser storage: ${quotaText}`,
      `Playback probes: MP4/H.264 ${media.canPlayType('video/mp4; codecs="avc1.42E01E"') || 'unknown'} · HLS ${media.canPlayType('application/vnd.apple.mpegurl') || media.canPlayType('application/x-mpegURL') || 'unknown'}`
    ];
    diagnosticsSummary.textContent = report.join('\n');
    cacheStatus.textContent = 'Cache cleanup removes only saved catalog snapshots. Profiles, provider login, favorites, history, and settings stay in local storage.';
  } catch (error) {
    diagnosticsSummary.textContent = error instanceof Error ? `Diagnostics unavailable: ${error.message}` : 'Diagnostics are unavailable on this browser.';
  }
}

async function clearSavedCaches(): Promise<void> {
  cacheStatus.textContent = 'Clearing the rebuildable catalog cache…';
  try {
    await clearRebuildableCaches();
    cacheStatus.textContent = 'Cached catalog data cleared. Your provider login, profiles, favorites, watch history, and preferences are preserved.';
    await refreshDiagnostics();
  } catch (error) {
    cacheStatus.textContent = error instanceof Error ? error.message : 'Could not clear the app cache.';
  }
}

function compareVersions(left: string, right: string): number {
  const parts = (value: string) => value.replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

async function checkForAppUpdate(): Promise<void> {
  updateStatus.textContent = 'Checking public GitHub Releases…';
  releaseLink.classList.add('hidden');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('https://api.github.com/repos/marcpnut/nextflix-webos/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    const release = await response.json() as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
    if (!release.tag_name || !release.html_url || release.draft || release.prerelease) throw new Error('No public stable release was found.');
    const latest = release.tag_name.replace(/^v/i, '');
    if (compareVersions(latest, APP_VERSION) > 0) {
      updateStatus.textContent = `NextFlix ${latest} is available. Download and install it manually when convenient; playback and app data are never replaced automatically.`;
      releaseLink.href = release.html_url;
      releaseLink.classList.remove('hidden');
    } else {
      updateStatus.textContent = `This app is up to date (${APP_VERSION}).`;
    }
  } catch (error) {
    updateStatus.textContent = error instanceof Error && error.name === 'AbortError'
      ? 'The release check timed out. Try again when the TV has a connection.'
      : error instanceof Error ? `Could not check releases: ${error.message}` : 'Could not check public releases.';
  } finally {
    window.clearTimeout(timeout);
  }
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

function schedulePlayerControlsHide(): void {
  window.clearTimeout(playerControlsHideTimer);
  playerControlsHideTimer = 0;
  if (playerLayer.classList.contains('hidden') || video.paused) return;
  playerControlsHideTimer = window.setTimeout(() => {
    playerControlsHideTimer = 0;
    if (openTrackMenu || video.paused) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && playerLayer.contains(active) && active !== video) active.blur();
    playerLayer.classList.add('controls-hidden');
  }, 5000);
}

function revealPlayerControls(focusPlaybackControl = false): void {
  window.clearTimeout(playerControlsHideTimer);
  playerControlsHideTimer = 0;
  playerLayer.classList.remove('controls-hidden');
  if (focusPlaybackControl && playerLayer.contains(document.activeElement)) playPauseButton.focus();
  schedulePlayerControlsHide();
}

function movePlayerControlFocus(keyCode: number): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !active.closest('.player-controls')) return false;
  if (keyCode !== 37 && keyCode !== 39) return false;
  const controls = Array.from(playerLayer.querySelectorAll<HTMLButtonElement>('.player-controls button'))
    .filter(elementIsVisible);
  const index = controls.indexOf(active as HTMLButtonElement);
  const target = controls[index + (keyCode === 39 ? 1 : -1)];
  if (!target) return false;
  target.focus();
  schedulePlayerControlsHide();
  return true;
}

function raiseHtmlSubtitleCues(): void {
  const tracks = tracksOf(subtitleTrackList());
  tracks.forEach((track) => {
    const cues = (track as MediaTrack & { cues?: TextTrackCueList | null }).cues;
    if (!cues) return;
    for (let index = 0; index < cues.length; index += 1) {
      const cue = cues[index] as TextTrackCue & { line?: number | 'auto'; snapToLines?: boolean };
      try {
        cue.snapToLines = false;
        cue.line = 82;
      } catch { /* Native TV-rendered tracks may not expose cue positioning. */ }
    }
  });
}

function updatePlaybackControls(): void {
  const live = selectedChannel !== null;
  previousChannelButton.classList.toggle('hidden', !live);
  nextChannelButton.classList.toggle('hidden', !live);
  seekBackButton.classList.toggle('hidden', live);
  seekForwardButton.classList.toggle('hidden', live);
  updateTrackButtonVisibility();
}

function audioTrackList(): TrackList | null {
  try { return (video as HTMLVideoElement & { audioTracks?: TrackList }).audioTracks ?? null; }
  catch { return null; }
}

function subtitleTrackList(): TrackList | null {
  return video.textTracks as unknown as TrackList;
}

function tracksOf(list: TrackList | null): MediaTrack[] {
  if (!list) return [];
  const tracks: MediaTrack[] = [];
  for (let index = 0; index < list.length; index += 1) tracks.push(list[index]);
  return tracks;
}

function subtitleTracks(): SubtitleTrackChoice[] {
  const htmlTracks = tracksOf(subtitleTrackList())
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !track.kind || ['subtitles', 'captions', 'forced'].includes(track.kind))
    .map(({ track, index }) => ({ source: 'html' as const, track, index, language: track.language, label: track.label || track.language || `Subtitle ${index + 1}` }));
  if (htmlTracks.length) return htmlTracks;
  return webOsSubtitleAdapter.availableTracks.map((track: WebOsSubtitleTrack) => ({
    source: 'webos' as const,
    index: track.index,
    language: track.language,
    label: track.label
  }));
}

function normalizeTrackLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
}

function trackMatchesPreferences(track: MediaTrack, preferences: string[]): boolean {
  const language = normalizeTrackLanguage(track.language ?? '');
  const label = (track.label ?? '').toLowerCase();
  return preferences.some((preference) => {
    const normalized = normalizeTrackLanguage(preference);
    return normalized && (normalized === language || label.includes(normalized));
  });
}

function updateTrackButtonVisibility(): void {
  subtitleTracksButton.classList.remove('hidden');
}

function keepMainAudioTrack(): void {
  const audioTracks = tracksOf(audioTrackList());
  if (!audioTracks.length) return;
  const mainIndices = audioTracks.map((track, index) => track.kind?.toLowerCase() === 'main' ? index : -1).filter((index) => index >= 0);
  if (!mainIndices.length) return; // Preserve the provider/decoder's chosen default when roles are not exposed.
  const selectedIndex = mainIndices.find((index) => audioTracks[index].enabled) ?? mainIndices[0];
  audioTracks.forEach((track, index) => { try { track.enabled = index === selectedIndex; } catch { /* Leave decoder selection unchanged when track control is read-only. */ } });
}

function applyPreferredTracks(): void {
  keepMainAudioTrack();
  const subtitles = subtitleTracks();
  if (manualSubtitleTrack === null) {
    const preferred = subtitles.find((track) => trackMatchesPreferences(track, preferredSubtitleLanguages));
    if (preferred) {
      selectSubtitleTrack(preferred, false);
    } else {
      subtitles.forEach((choice) => { if (choice.source === 'html' && choice.track) choice.track.mode = 'disabled'; });
      if (webOsSubtitleAdapter.availableTracks.length) void webOsSubtitleAdapter.select(null).catch(() => undefined);
    }
  } else if (manualSubtitleTrack === 'off') {
    subtitles.forEach((choice) => { if (choice.source === 'html' && choice.track) choice.track.mode = 'disabled'; });
    if (webOsSubtitleAdapter.availableTracks.length) void webOsSubtitleAdapter.select(null).catch(() => undefined);
  }
  updateTrackButtonVisibility();
  if (openTrackMenu) renderTrackMenu();
}

function observeAvailableTracks(): void {
  const lists = [audioTrackList(), video.textTracks as unknown as TrackList].filter((list): list is TrackList => !!list);
  for (const list of lists) {
    if (observedTrackLists.has(list)) continue;
    observedTrackLists.add(list);
    list.addEventListener?.('addtrack', () => { applyPreferredTracks(); raiseHtmlSubtitleCues(); });
    list.addEventListener?.('change', () => { applyPreferredTracks(); raiseHtmlSubtitleCues(); });
  }
}

function closeTrackMenu(restoreFocus = true): void {
  openTrackMenu = false;
  trackMenu.classList.add('hidden');
  if (restoreFocus) subtitleTracksButton.focus();
  schedulePlayerControlsHide();
}

function selectSubtitleTrack(choice: SubtitleTrackChoice, manual: boolean): void {
  if (manual) manualSubtitleTrack = choice;
  if (choice.source === 'webos') {
    void webOsSubtitleAdapter.select(choice.index).then(() => {
      playerMessage.textContent = '';
    }).catch((error: unknown) => {
      playerMessage.textContent = error instanceof Error ? error.message : 'The TV could not select this subtitle.';
    });
    return;
  }
  const tracks = tracksOf(subtitleTrackList()).filter((track) => !track.kind || ['subtitles', 'captions', 'forced'].includes(track.kind));
  tracks.forEach((track, index) => { try { track.mode = index === choice.index ? 'showing' : 'disabled'; } catch { /* Ignore unsupported native text-track controls. */ } });
  raiseHtmlSubtitleCues();
}

async function findOnlineSubtitles(): Promise<void> {
  const entry = currentVodEntry;
  if (!entry || !opensubtitlesKey || onlineSubtitleLoading || onlineSubtitleChoices.length) return;
  const generation = playbackGeneration;
  onlineSubtitleLoading = true;
  playerMessage.textContent = 'Searching OpenSubtitles for this title…';
  try {
    const choices = await searchOnlineSubtitles(opensubtitlesKey, entry.kind === 'series' ? entry.seriesTitle ?? entry.title : entry.title,
      preferredSubtitleLanguages.length ? preferredSubtitleLanguages : ['nl', 'en'], entry.season, entry.episodeNumber);
    if (generation !== playbackGeneration) return;
    onlineSubtitleChoices = choices;
    playerMessage.textContent = onlineSubtitleChoices.length
      ? `${onlineSubtitleChoices.length} online subtitles found. Open Subtitles to choose one; timing may differ from this stream.`
      : 'No online subtitle matched this title and language.';
    if (openTrackMenu) renderTrackMenu();
  } catch (error) {
    if (generation === playbackGeneration) playerMessage.textContent = error instanceof Error ? error.message : 'Online subtitle search failed.';
  } finally { onlineSubtitleLoading = false; }
}

async function addOnlineSubtitle(choice: OnlineSubtitle): Promise<void> {
  const generation = playbackGeneration;
  playerMessage.textContent = `Downloading ${choice.language} subtitles…`;
  try {
    const vtt = await downloadOnlineSubtitle(opensubtitlesKey, choice.fileId);
    if (generation !== playbackGeneration) return;
    if (externalSubtitleElement) externalSubtitleElement.remove();
    if (externalSubtitleUrl) URL.revokeObjectURL(externalSubtitleUrl);
    externalSubtitleUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    const element = document.createElement('track');
    element.kind = 'subtitles';
    element.label = `OpenSubtitles · ${choice.language}`;
    element.srclang = choice.language.split('-')[0];
    element.src = externalSubtitleUrl;
    video.appendChild(element);
    externalSubtitleElement = element;
    const tracks = tracksOf(subtitleTrackList());
    tracks.forEach((track) => { try { track.mode = 'disabled'; } catch { /* Some TV tracks are read-only. */ } });
    element.track.mode = 'showing';
    manualSubtitleTrack = { source: 'html', index: Math.max(0, tracks.length - 1), track: element.track, language: element.srclang, label: element.label };
    raiseHtmlSubtitleCues();
    playerMessage.textContent = `Using ${choice.language} subtitles from OpenSubtitles.`;
  } catch (error) {
    if (generation === playbackGeneration) playerMessage.textContent = error instanceof Error ? error.message : 'Could not load online subtitles.';
  }
}

function renderTrackMenu(): void {
  const tracks = subtitleTracks();
  clearChildren(trackOptions);
  trackMenuTitle.textContent = 'Subtitles';
  const addOption = (label: string, selected: boolean, onSelect: () => void): void => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `track-option${selected ? ' selected' : ''}`;
    option.textContent = label;
    option.setAttribute('aria-pressed', String(selected));
    option.addEventListener('click', () => { onSelect(); closeTrackMenu(); });
    trackOptions.appendChild(option);
  };
  addOption('Auto · preferred language', manualSubtitleTrack === null, () => {
      manualSubtitleTrack = null;
      applyPreferredTracks();
  });
  addOption('Off', manualSubtitleTrack === 'off' || (manualSubtitleTrack === null && !tracks.some((choice) => choice.source === 'html' && choice.track?.mode === 'showing')), () => {
    manualSubtitleTrack = 'off';
    tracks.forEach((choice) => { if (choice.source === 'html' && choice.track) choice.track.mode = 'disabled'; });
    if (webOsSubtitleAdapter.availableTracks.length) void webOsSubtitleAdapter.select(null).catch(() => undefined);
  });
  tracks.forEach((choice) => {
    const selected = manualSubtitleTrack !== 'off' && (manualSubtitleTrack
      ? manualSubtitleTrack.source === choice.source && manualSubtitleTrack.index === choice.index
      : choice.source === 'html' && choice.track?.mode === 'showing');
    addOption(choice.label, selected, () => selectSubtitleTrack(choice, true));
  });
  if (currentVodEntry && opensubtitlesKey) {
    if (onlineSubtitleChoices.length) {
      onlineSubtitleChoices.slice(0, 12).forEach((choice) => {
        addOption(`${choice.language.toUpperCase()} · ${choice.release || 'Online subtitle'}`, false, () => { void addOnlineSubtitle(choice); });
      });
    } else {
      addOption(onlineSubtitleLoading ? 'Searching OpenSubtitles…' : 'Find subtitles on OpenSubtitles', false, () => { void findOnlineSubtitles(); });
    }
  }
}

function showTrackMenu(): void {
  revealPlayerControls(false);
  applyPreferredTracks();
  const tracks = subtitleTracks();
  if (!tracks.length && !opensubtitlesKey) playerMessage.textContent = 'No selectable subtitles found. Add an OpenSubtitles.com API key in Settings to search online.';
  openTrackMenu = true;
  renderTrackMenu();
  trackMenu.classList.remove('hidden');
  window.clearTimeout(playerControlsHideTimer);
  playerControlsHideTimer = 0;
  trackOptions.querySelector<HTMLButtonElement>('.selected')?.focus();
  if (!tracks.length) void findOnlineSubtitles();
}

trackMenu.addEventListener('focusout', (event: FocusEvent) => {
  const next = event.relatedTarget;
  if (next instanceof Node && trackMenu.contains(next)) return;
  if (openTrackMenu) closeTrackMenu(false);
});

function stopEpisodeCountdown(): void {
  if (episodeCountdownTimer) window.clearInterval(episodeCountdownTimer);
  episodeCountdownTimer = 0;
  nextEpisode = null;
  nextEpisodePrompt.classList.add('hidden');
}

function startEpisodeCountdown(): void {
  stopEpisodeCountdown();
  if (!currentVodEntry || currentVodEntry.kind !== 'series' || !activeSeries || String(activeSeries.series_id) !== currentVodEntry.seriesId) {
    playerMessage.textContent = 'Playback finished.';
    return;
  }
  const ordered = [...seriesEpisodes].sort((left, right) => {
    const seasonDifference = Number(left.season ?? 0) - Number(right.season ?? 0);
    return seasonDifference || Number(left.episode_num ?? 0) - Number(right.episode_num ?? 0);
  });
  const index = ordered.findIndex((episode) => String(episode.id) === currentVodEntry?.id);
  nextEpisode = index >= 0 ? ordered[index + 1] ?? null : null;
  if (!nextEpisode) {
    playerMessage.textContent = 'Playback finished.';
    return;
  }
  let secondsLeft = 10;
  const updateLabel = (): void => { nextEpisodeCountdown.textContent = `Next episode in ${secondsLeft} seconds`; };
  nextEpisodePrompt.classList.remove('hidden');
  updateLabel();
  nextEpisodePlayButton.focus();
  episodeCountdownTimer = window.setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      const episode = nextEpisode;
      stopEpisodeCountdown();
      if (episode) void playVod(episode.title ?? `Episode ${episode.episode_num ?? ''}`.trim(), episode.id, episode.container_extension, 'series');
      return;
    }
    updateLabel();
  }, 1000);
}

function saveTrackPreferences(): void {
  preferredSubtitleLanguages = subtitleLanguagePreferencesInput.value ? [subtitleLanguagePreferencesInput.value] : [];
  try {
    localStorage.setItem(profileStorageKey(TRACK_PREFERENCES_KEY), JSON.stringify({ subtitles: preferredSubtitleLanguages }));
  } catch { /* Track preferences remain active for this session. */ }
  manualSubtitleTrack = null;
  applyPreferredTracks();
}

function populateLanguagePreferences(): void {
  const languages: Array<[string, string]> = [
    ['en', 'English'], ['nl', 'Dutch'], ['de', 'German'], ['pl', 'Polish'], ['fr', 'French'], ['es', 'Spanish'],
    ['it', 'Italian'], ['pt', 'Portuguese'], ['sv', 'Swedish'], ['no', 'Norwegian'], ['da', 'Danish'],
    ['fi', 'Finnish'], ['ar', 'Arabic'], ['tr', 'Turkish'], ['ru', 'Russian'], ['uk', 'Ukrainian'],
    ['el', 'Greek'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['cs', 'Czech'], ['ro', 'Romanian'],
    ['hu', 'Hungarian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese']
  ];
  clearChildren(subtitleLanguagePreferencesInput);
  subtitleLanguagePreferencesInput.appendChild(new Option('Off / no preference', ''));
  for (const [code, label] of languages) {
    const option = `${label} (${code})`;
    subtitleLanguagePreferencesInput.appendChild(new Option(option, code));
  }
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
    const orderedHistory = [entry, ...watchHistory.filter((item) => item.key !== entry.key)]
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const otherProfiles = orderedHistory.filter((item) => item.scope !== entry.scope);
    const currentProfile = orderedHistory.filter((item) => item.scope === entry.scope).slice(0, 40);
    watchHistory = [...currentProfile, ...otherProfiles].slice(0, 320);
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
    const fullTitle = entry.seriesTitle
      ? `${entry.seriesTitle} · S${entry.season ?? '?'} E${entry.episodeNumber ?? '?'}`
      : entry.title;
    title.textContent = truncateCardTitle(fullTitle, 24);
    title.title = fullTitle;
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

function truncateCardTitle(title: string, maximum: number): string {
  if (title.length <= maximum) return title;
  return `${title.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function favoriteKey(kind: 'movie' | 'series', id: number | string): string {
  return `${kind}:${id}`;
}

function saveFavorites(): void {
  try { localStorage.setItem(profileStorageKey(FAVORITES_KEY), JSON.stringify(Array.from(favorites))); } catch { /* Keep favorites in memory for this session. */ }
}

function toggleFavorite(kind: 'movie' | 'series', id: number | string): void {
  const key = favoriteKey(kind, id);
  if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
  saveFavorites();
  detailListButton.textContent = favorites.has(key) ? 'Remove from My List' : 'Add to My List';
  if (currentPage === 'my-list') renderMyList();
}

async function enrichDetail(kind: 'movie' | 'series', item: Movie | Series, title: string, year: string): Promise<void> {
  if (!omdbApiKey) return;
  detailSource.textContent = 'Loading movie information from OMDb…';
  try {
    const metadata = await findOmdbMetadata(kind, title, year, omdbApiKey);
    if (currentPage !== 'detail' || detailItem?.item !== item) return;
    if (!metadata) {
      detailSource.textContent = 'No exact OMDb match; showing provider information.';
      return;
    }
    if (metadata.overview) detailDescription.textContent = metadata.overview;
    if (metadata.cast) detailCast.textContent = `Cast: ${metadata.cast}`;
    const currentMeta = detailMeta.textContent?.trim() ?? '';
    const metadataYear = metadata.year && !currentMeta.includes(metadata.year) ? metadata.year : '';
    if (metadataYear || metadata.genres) detailMeta.textContent = [metadataYear, currentMeta, metadata.genres].filter(Boolean).join(' · ');
    if (!detailPoster.getAttribute('src') && metadata.poster) {
      detailPoster.src = metadata.poster;
      detailPoster.classList.remove('hidden');
    }
    detailSource.textContent = 'Movie information from OMDb · CC BY-NC 4.0';
  } catch (error) {
    if (currentPage === 'detail' && detailItem?.item === item) {
      detailSource.textContent = error instanceof Error ? `OMDb unavailable: ${error.message}` : 'OMDb information is unavailable.';
    }
  }
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
  detailCast.textContent = '';
  detailSource.textContent = '';
  detailPoster.src = item.stream_icon ?? '';
  detailPoster.classList.toggle('hidden', !item.stream_icon);
  const resumeEntry = watchEntryForMovie(item.stream_id);
  detailPlayButton.textContent = resumeEntry ? `Resume · ${playbackTime(resumeEntry.position)}` : 'Play movie';
  detailStartOverButton.classList.toggle('hidden', !resumeEntry);
  detailListButton.textContent = favorites.has(favoriteKey('movie', item.stream_id)) ? 'Remove from My List' : 'Add to My List';
  showPage('detail');
  detailPlayButton.focus();
  void enrichDetail('movie', item, item.name ?? '', String(item.year ?? ''));
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
  detailCast.textContent = '';
  detailSource.textContent = '';
  detailPoster.src = item.cover ?? '';
  detailPoster.classList.toggle('hidden', !item.cover);
  detailPlayButton.textContent = 'View episodes';
  detailStartOverButton.classList.add('hidden');
  detailListButton.textContent = favorites.has(favoriteKey('series', item.series_id)) ? 'Remove from My List' : 'Add to My List';
  showPage('detail');
  detailPlayButton.focus();
  void enrichDetail('series', item, item.name ?? '', item.releaseDate ?? '');
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
    label.textContent = truncateCardTitle(title, 22);
    label.title = title;
    button.appendChild(label);
    button.addEventListener('click', () => kind === 'movie' ? showMovieDetails(item as Movie) : showSeriesDetails(item as Series));
    container.appendChild(button);
  }
}

function categorySignal(view: CatalogView, categoryId?: string | number): string {
  if (categoryId === undefined) return '';
  const category = categoriesFor(view).find((entry) => String(entry.category_id) === String(categoryId));
  return category?.category_name?.trim().toLocaleLowerCase() ?? '';
}

function renderRecommendations(): void {
  clearChildren(homeRecommended);
  const signalWeights = new Map<string, number>();
  const addSignal = (signal: string, amount: number): void => {
    const normalized = signal.trim().toLocaleLowerCase();
    if (normalized) signalWeights.set(normalized, (signalWeights.get(normalized) ?? 0) + amount);
  };
  const scopeHistory = watchHistory.filter((entry) => entry.scope === watchScope);
  for (const entry of scopeHistory) {
    addSignal(entry.genre ?? '', 3);
    addSignal(categorySignal(entry.kind === 'movie' ? 'movies' : 'series', entry.categoryId), 2);
    if (entry.seriesId) {
      const show = series.find((candidate) => String(candidate.series_id) === entry.seriesId);
      for (const genre of show?.genre?.split(/[,/|]/) ?? []) addSignal(genre, 3);
    }
  }
  for (const key of favorites) {
    const [kind, ...idParts] = key.split(':');
    const id = idParts.join(':');
    if (kind === 'movie') {
      const item = movies.find((candidate) => String(candidate.stream_id) === id);
      addSignal(categorySignal('movies', item?.category_id), 4);
    } else if (kind === 'series') {
      const item = series.find((candidate) => String(candidate.series_id) === id);
      addSignal(categorySignal('series', item?.category_id), 4);
      for (const genre of item?.genre?.split(/[,/|]/) ?? []) addSignal(genre, 4);
    }
  }

  const seen = new Set(scopeHistory.map((entry) => `${entry.kind}:${entry.id}`));
  const candidates: Array<{ kind: 'movie' | 'series'; item: Movie | Series; score: number; order: number }> = [];
  movies.forEach((item, order) => {
    if (!item.name || !isCategoryEnabled('movies', item.category_id) || favorites.has(favoriteKey('movie', item.stream_id))
      || seen.has(`movie:${item.stream_id}`)) return;
    const signal = categorySignal('movies', item.category_id);
    candidates.push({ kind: 'movie', item, score: (signalWeights.get(signal) ?? 0) * 10 + (Number(item.rating) || 0), order });
  });
  series.forEach((item, order) => {
    if (!item.name || !isCategoryEnabled('series', item.category_id) || favorites.has(favoriteKey('series', item.series_id))
      || seen.has(`series:${item.series_id}`)) return;
    const signals = [categorySignal('series', item.category_id), ...(item.genre?.split(/[,/|]/) ?? [])]
      .map((signal) => signal.trim().toLocaleLowerCase()).filter(Boolean);
    const score = signals.reduce((sum, signal) => sum + (signalWeights.get(signal) ?? 0) * 10, 0) + (Number(item.rating) || 0);
    candidates.push({ kind: 'series', item, score, order: movies.length + order });
  });
  candidates.sort((left, right) => right.score - left.score || left.order - right.order);
  const picks = candidates.slice(0, 12);
  recommendedRow.classList.toggle('hidden', picks.length === 0);
  for (const pick of picks) {
    const item = pick.item as Movie & Series;
    const title = item.name ?? 'Untitled';
    const posterUrl = pick.kind === 'movie' ? (item as Movie).stream_icon : (item as Series).cover;
    const button = document.createElement('button');
    button.className = 'poster-tile';
    button.type = 'button';
    button.setAttribute('aria-label', `Recommended ${pick.kind}: ${title}`);
    if (posterUrl) {
      const image = document.createElement('img');
      image.src = posterUrl;
      image.alt = '';
      image.setAttribute('loading', 'lazy');
      image.addEventListener('error', () => image.classList.add('hidden'));
      button.appendChild(image);
    }
    const label = document.createElement('span');
    label.textContent = truncateCardTitle(title, 22);
    label.title = title;
    button.appendChild(label);
    button.addEventListener('click', () => pick.kind === 'movie'
      ? showMovieDetails(pick.item as Movie)
      : showSeriesDetails(pick.item as Series));
    homeRecommended.appendChild(button);
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
  renderRecommendations();
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
    label.textContent = truncateCardTitle(title, 30);
    label.title = title;
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
      if (view === 'movies' || view === 'series') catalogPages[view] = 1;
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
    activeSeries = null;
    seriesEpisodes = [];
  }
  if (page === 'search') {
    if (!['live', 'movies', 'series'].includes(catalogView)) catalogView = 'movies';
  }
  placeLanguageFilter();
  syncLiveChannelScrollMode();
  renderLanguageFilter();
  if (showCatalogPage && !leavingDetail) {
    updateCatalogHeading();
    renderChannels();
  }
  if (page === 'home') renderHome();
  if (page === 'settings') renderCategorySettings();
  if (page === 'settings') void refreshDiagnostics();
  if (page === 'my-list') renderMyList();
  syncLivePreviewVisibility();
  const selectedNavPage = page === 'detail' ? previousPage : page;
  document.querySelectorAll<HTMLButtonElement>('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.page === selectedNavPage));
  syncAllDropdowns();
  if (page === 'search') window.setTimeout(() => focusInputProxy(searchInput), 0);
  if (leavingDetail && detailReturnFocus?.isConnected) {
    detailReturnFocus.focus();
    detailReturnFocus = null;
  }
}

function updateCatalogHeading(): void {
  placeLanguageFilter();
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
  const categoryControl = dropdownControls.get(categorySelect);
  if (categoryControl) syncDropdown(categoryControl);
  syncLiveChannelScrollMode();
  syncLivePreviewVisibility();
}

function syncLivePreviewVisibility(): void {
  const shouldShow = currentPage === 'live' && catalogView === 'live' && !activeSeries
    && !librarySection.classList.contains('hidden');
  livePreview.classList.toggle('hidden', !shouldShow);
  if (!shouldShow && video.parentElement === livePreview) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    webOsSubtitleAdapter.stop();
    moveVideoToPlayer();
    livePreviewTitle.textContent = 'Select a channel';
    livePreviewMessage.textContent = 'Choose a channel to start the preview.';
    selectedChannel = null;
    returnToLivePreviewOnPlayerClose = false;
  }
}

function syncLiveChannelScrollMode(): void {
  const liveList = !librarySection.classList.contains('hidden') && catalogView === 'live' && !activeSeries;
  appContent.classList.toggle('live-channel-layout', liveList);
  librarySection.classList.toggle('live-channel-layout', liveList);
}

function placeLanguageFilter(): void {
  if (currentPage === 'settings') {
    appContent.insertBefore(languageFilter, settingsView);
    return;
  }
  if (['movies', 'series', 'live', 'search'].includes(currentPage) && !librarySection.classList.contains('hidden')) {
    const actions = librarySection.querySelector<HTMLElement>('.library-actions');
    if (actions) actions.insertBefore(languageFilter, actions.firstChild);
    return;
  }
  appContent.insertBefore(languageFilter, appContent.firstElementChild);
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
    await pruneRebuildableCaches();
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
    catalogCacheKey = cacheKey;
    watchScope = profileScopeForCatalog(cacheKey);
    migrateLegacyWatchHistory(cacheKey);
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
      await pruneRebuildableCaches();
      catalogView = 'live';
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
      items.push({ title: channel.name ?? 'Unknown channel', meta: String(channel.num ?? 'Live TV'), channel, onSelect: () => selectLiveChannel(channel) });
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
    channelListScroll.scrollTop = 0;
    clearChildren(channelList);
  }
  const pagedCatalog = !activeSeries && (catalogView === 'movies' || catalogView === 'series');
  let next: typeof items;
  if (pagedCatalog) {
    const view = catalogView as 'movies' | 'series';
    catalogTotalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    catalogPages[view] = Math.max(1, Math.min(catalogPages[view], catalogTotalPages));
    const page = catalogPages[view];
    next = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    pagination.classList.toggle('hidden', items.length === 0);
    previousPageButton.disabled = page <= 1;
    nextPageButton.disabled = page >= catalogTotalPages;
    pageIndicator.textContent = `Page ${page} of ${catalogTotalPages}`;
    moreButton.classList.add('hidden');
  } else {
    next = items.slice(renderedCount, renderedCount + LIVE_BATCH_SIZE);
    pagination.classList.add('hidden');
  }
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
      const labelGroup = document.createElement('span');
      labelGroup.className = 'channel-label-group';
      labelGroup.appendChild(name);
      button.appendChild(number);
      button.appendChild(labelGroup);
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
      title.textContent = truncateCardTitle(item.title, 30);
      title.title = item.title;
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
  if (!pagedCatalog) moreButton.classList.toggle('hidden', renderedCount >= items.length || (catalogView === 'live' && !activeSeries));
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = catalogView === 'live' ? 'No channels match this search or category.' : 'No titles match this search or category.';
    channelList.appendChild(empty);
  }
}

async function fetchSeriesEpisodes(seriesId: string | number): Promise<SeriesEpisode[]> {
  const response = await api<{ episodes?: Record<string, SeriesEpisode[]> }>('get_series_info', { series_id: String(seriesId) }, 120_000);
  const episodes: SeriesEpisode[] = [];
  for (const seasonKey of Object.keys(response.episodes ?? {})) {
    for (const episode of response.episodes?.[seasonKey] ?? []) {
      if (episode.season === undefined) episode.season = seasonKey;
      episodes.push(episode);
    }
  }
  return episodes.sort((left, right) => {
    const seasonDifference = Number(left.season ?? 0) - Number(right.season ?? 0);
    return seasonDifference || Number(left.episode_num ?? 0) - Number(right.episode_num ?? 0);
  });
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
    seriesEpisodes = await fetchSeriesEpisodes(item.series_id);
    renderChannels();
    libraryMessage.textContent = seriesEpisodes.length ? `${seriesEpisodes.length} episodes` : 'No episodes were returned for this series.';
    libraryMessage.classList.remove('loading');
  } catch (error) {
    libraryMessage.textContent = error instanceof Error ? error.message : 'Could not load this series.';
    libraryMessage.classList.remove('loading');
    libraryMessage.classList.add('error');
  }
}

function moveVideoToPlayer(): void {
  if (video.parentElement !== playerLayer) playerLayer.insertBefore(video, playerLayer.firstChild);
}

function showLiveChannelFullscreen(): void {
  if (!selectedChannel) return;
  moveVideoToPlayer();
  livePreview.classList.add('hidden');
  playerLayer.classList.remove('hidden');
  returnToLivePreviewOnPlayerClose = currentPage === 'live' && catalogView === 'live' && !activeSeries;
  revealPlayerControls(false);
  playPauseButton.focus();
}

function selectLiveChannel(channel: Channel): void {
  const samePreview = selectedChannel
    && String(selectedChannel.stream_id) === String(channel.stream_id)
    && video.parentElement === livePreview;
  if (samePreview) {
    showLiveChannelFullscreen();
    return;
  }
  void playChannel(channel, 'preview');
}

async function playChannel(channel: Channel, display: 'fullscreen' | 'preview' = 'fullscreen'): Promise<void> {
  if (!credentials) return;
  if (channel.stream_url) {
    await startPlayback(channel.name ?? 'Live TV', channel.stream_url, channel, undefined, display);
    return;
  }
  const ext = activeLiveFormat ?? 'ts';
  const path = ['live', credentials.username, credentials.password, `${channel.stream_id}.${ext}`]
    .map((part) => encodeURIComponent(part)).join('/');
  await startPlayback(channel.name ?? 'Live TV', `${playbackBase ?? credentials.base}/${path}`, channel, undefined, display);
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
  if (kind === 'series' && seriesId && (!activeSeries || String(activeSeries.series_id) !== seriesId)) {
    const seriesItem = series.find((item) => String(item.series_id) === seriesId);
    if (seriesItem) {
      activeSeries = seriesItem;
      seriesEpisodes = [];
      void fetchSeriesEpisodes(seriesId).then((episodes) => {
        if (activeSeries && String(activeSeries.series_id) === seriesId) seriesEpisodes = episodes;
      }).catch(() => { /* Continue Watching remains usable if episode metadata is unavailable. */ });
    }
  }
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
    updatedAt: matchingHistory?.updatedAt ?? Date.now(),
    genre: matchingHistory?.genre ?? activeSeries?.genre
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
  resume?: { entry: WatchProgress; position: number },
  display: 'fullscreen' | 'preview' = 'fullscreen'
): Promise<void> {
  playbackGeneration += 1;
  onlineSubtitleChoices = [];
  onlineSubtitleLoading = false;
  if (externalSubtitleElement) externalSubtitleElement.remove();
  externalSubtitleElement = null;
  if (externalSubtitleUrl) URL.revokeObjectURL(externalSubtitleUrl);
  externalSubtitleUrl = '';
  saveWatchProgress(true);
  stopSeekHold();
  stopEpisodeCountdown();
  closeTrackMenu(false);
  window.clearTimeout(playerControlsHideTimer);
  playerControlsHideTimer = 0;
  playerLayer.classList.remove('controls-hidden');
  webOsSubtitleAdapter.stop();
  manualSubtitleTrack = null;
  playingTitle.textContent = title;
  playerMessage.textContent = 'Connecting to stream…';
  livePreviewTitle.textContent = title;
  livePreviewMessage.textContent = display === 'preview' ? 'Connecting to channel…' : '';
  if (display === 'preview' && channel) {
    livePreview.appendChild(video);
    livePreview.classList.remove('hidden');
    playerLayer.classList.add('hidden');
    returnToLivePreviewOnPlayerClose = true;
  } else {
    moveVideoToPlayer();
    livePreview.classList.add('hidden');
    playerLayer.classList.remove('hidden');
    returnToLivePreviewOnPlayerClose = !!channel && currentPage === 'live' && catalogView === 'live' && !activeSeries;
  }
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
    livePreviewMessage.textContent = '';
    if (display === 'fullscreen') playPauseButton.focus();
  } catch (error) {
    playerMessage.textContent = describePlaybackFailure(error);
    if (display === 'preview') livePreviewMessage.textContent = playerMessage.textContent;
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

function closePlayer(stopPlayback = false): void {
  const returnToPreview = !stopPlayback && returnToLivePreviewOnPlayerClose && !!selectedChannel
    && currentPage === 'live' && catalogView === 'live' && !activeSeries
    && !librarySection.classList.contains('hidden');
  saveWatchProgress(true);
  if (!returnToPreview) webOsSubtitleAdapter.stop();
  stopSeekHold();
  stopEpisodeCountdown();
  closeTrackMenu(false);
  window.clearTimeout(playerControlsHideTimer);
  playerControlsHideTimer = 0;
  playerLayer.classList.remove('controls-hidden');
  playerLayer.classList.add('hidden');
  playerMessage.textContent = '';
  currentVodEntry = null;
  seekRow.classList.add('hidden');
  if (returnToPreview && selectedChannel) {
    livePreviewTitle.textContent = selectedChannel.name ?? 'Live TV';
    livePreviewMessage.textContent = '';
    livePreview.appendChild(video);
    livePreview.classList.remove('hidden');
    returnToLivePreviewOnPlayerClose = true;
    const selectedCard = Array.from(channelList.querySelectorAll<HTMLButtonElement>('.channel-card'))
      .find((card) => card.dataset.streamId === String(selectedChannel?.stream_id));
    (selectedCard ?? channelList.querySelector<HTMLButtonElement>('.channel-card'))?.focus();
  } else {
    video.pause();
    video.removeAttribute('src');
    video.load();
    moveVideoToPlayer();
    livePreview.classList.add('hidden');
    selectedChannel = null;
    returnToLivePreviewOnPlayerClose = false;
    if (!librarySection.classList.contains('hidden')) channelList.querySelector<HTMLButtonElement>('button')?.focus();
    else if (!detailView.classList.contains('hidden')) detailPlayButton.focus();
    else document.querySelector<HTMLButtonElement>(`.nav-button[data-page="${currentPage === 'detail' ? previousPage : currentPage}"]`)?.focus();
  }
}

function switchChannel(direction: -1 | 1): void {
  if (!selectedChannel || !visibleChannels.length) return;
  const index = visibleChannels.findIndex((channel) => String(channel.stream_id) === String(selectedChannel?.stream_id));
  const nextIndex = (index + direction + visibleChannels.length) % visibleChannels.length;
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
  if (!profileDialog.classList.contains('hidden')) {
    closeProfilesDialog();
    return;
  }
  if (!playerLayer.classList.contains('hidden')) {
    if (openTrackMenu) {
      closeTrackMenu();
      return;
    }
    if (!nextEpisodePrompt.classList.contains('hidden')) {
      stopEpisodeCountdown();
      playerMessage.textContent = 'Episode ended.';
      return;
    }
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

function elementIsVisible(element: HTMLElement): boolean {
  if (('disabled' in element && (element as HTMLButtonElement).disabled) || element.hidden || element.closest('.hidden,[hidden]')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function visibleContentRows(): HTMLButtonElement[][] {
  const items = Array.from(channelList.querySelectorAll<HTMLButtonElement>('.media-card, .channel-card'))
    .filter(elementIsVisible)
    .sort((left, right) => {
      const topDifference = left.getBoundingClientRect().top - right.getBoundingClientRect().top;
      return Math.abs(topDifference) > 18 ? topDifference : left.getBoundingClientRect().left - right.getBoundingClientRect().left;
    });
  const rows: HTMLButtonElement[][] = [];
  for (const item of items) {
    const top = item.getBoundingClientRect().top;
    let row = rows.find((candidate) => Math.abs(candidate[0].getBoundingClientRect().top - top) <= 18);
    if (!row) { row = []; rows.push(row); }
    row.push(item);
  }
  rows.forEach((row) => row.sort((left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left));
  return rows.sort((left, right) => left[0].getBoundingClientRect().top - right[0].getBoundingClientRect().top);
}

function focusFirstContentItem(): boolean {
  const first = visibleContentRows()[0]?.[0];
  if (first) { first.focus(); return true; }
  if (currentPage === 'settings') {
    const firstCategory = categoryVisibilityList.querySelector<HTMLElement>('input, button');
    if (firstCategory && elementIsVisible(firstCategory)) { firstCategory.focus(); return true; }
    const settingsControl = dropdownControls.get(settingsCategoryType)?.trigger;
    if (settingsControl && elementIsVisible(settingsControl)) { settingsControl.focus(); return true; }
  }
  if (currentPage === 'home') {
    const homeAction = [heroPlayButton, heroBrowseButton].find(elementIsVisible);
    if (homeAction) { homeAction.focus(); return true; }
  }
  if (currentPage === 'my-list') {
    const firstSaved = myListView.querySelector<HTMLElement>('.media-card, button');
    if (firstSaved && elementIsVisible(firstSaved)) { firstSaved.focus(); return true; }
  }
  const categoryTrigger = dropdownControls.get(categorySelect)?.trigger;
  if (categoryTrigger && elementIsVisible(categoryTrigger)) {
    focusDropdownTrigger(categorySelect);
    return true;
  }
  const languageTrigger = dropdownControls.get(languageSelect)?.trigger;
  if (languageTrigger && elementIsVisible(languageTrigger)) {
    languageTrigger.focus();
    return true;
  }
  const active = document.activeElement;
  return active instanceof HTMLElement ? focusBestGeometricCandidate(active, 39) : false;
}

function focusSelectedLanguage(): boolean {
  if (languageFilter.classList.contains('hidden')) return false;
  focusDropdownTrigger(languageSelect);
  return true;
}

function libraryActionTargets(): HTMLElement[] {
  const actions = Array.from(librarySection.querySelectorAll<HTMLElement>(
    '.library-heading .dropdown-trigger, .library-heading .input-proxy, .library-heading button'
  ));
  const language = dropdownControls.get(languageSelect)?.trigger;
  if (language && elementIsVisible(language) && !actions.includes(language)) actions.push(language);
  return actions.filter(elementIsVisible);
}

function focusClosestTopAction(active: HTMLElement): boolean {
  const bounds = active.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  const candidates = libraryActionTargets().filter((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return candidate !== active && rect.bottom <= bounds.top + 12;
  });
  candidates.sort((left, right) => {
    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const score = (rect: DOMRect) => Math.hypot(rect.left + rect.width / 2 - x, y - (rect.top + rect.height / 2));
    return score(a) - score(b);
  });
  if (!candidates[0]) return false;
  candidates[0].focus();
  return true;
}

function focusAdjacentLibraryAction(active: HTMLElement, keyCode: number): boolean {
  const bounds = active.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of libraryActionTargets()) {
    if (candidate === active) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - x;
    const dy = rect.top + rect.height / 2 - y;
    const primary = keyCode === 37 ? -dx : dx;
    if (primary <= 0) continue;
    const score = primary + Math.abs(dy) * 1.6;
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  if (!best) return false;
  best.focus();
  return true;
}

function focusActiveSidebarItem(): boolean {
  const activeNav = sidebar.querySelector<HTMLButtonElement>('.nav-button.active')
    ?? sidebar.querySelector<HTMLButtonElement>('.nav-button');
  if (!activeNav || !elementIsVisible(activeNav)) return false;
  activeNav.focus();
  return true;
}

function focusBestGeometricCandidate(active: HTMLElement, keyCode: number): boolean {
  const bounds = active.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  const scope: ParentNode = !playerLayer.classList.contains('hidden') ? playerLayer
    : exitConfirm.classList.contains('hidden') ? (appLayout.classList.contains('hidden') ? setupSection : appLayout) : exitConfirm;
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>('button, input, select, a[href]'))
    .filter((candidate) => candidate !== active && elementIsVisible(candidate));
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - x;
    const dy = rect.top + rect.height / 2 - y;
    const primary = keyCode === 37 ? -dx : keyCode === 39 ? dx : keyCode === 38 ? -dy : dy;
    if (primary <= 0) continue;
    const secondary = keyCode === 37 || keyCode === 39 ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 1.6;
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  if (!best) return false;
  best.focus();
  return true;
}

function moveDirectionalFocus(keyCode: number): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || editingInput === active || active.isContentEditable || active.tagName === 'TEXTAREA') return false;
  const rows = visibleContentRows();
  const rowIndex = rows.findIndex((row) => row.includes(active as HTMLButtonElement));
  if (rowIndex >= 0) {
    const row = rows[rowIndex];
    const itemIndex = row.indexOf(active as HTMLButtonElement);
    if (keyCode === 37) {
      if (itemIndex === 0) return focusActiveSidebarItem();
      row[itemIndex - 1].focus();
      return true;
    }
    if (keyCode === 39) {
      const next = row[itemIndex + 1];
      if (next) { next.focus(); return true; }
      return false;
    }
    if (keyCode === 38) {
      if (rowIndex === 0) return focusClosestTopAction(active);
      const previousRow = rows[rowIndex - 1];
      if (previousRow) {
        const x = active.getBoundingClientRect().left + active.getBoundingClientRect().width / 2;
        const target = previousRow.slice().sort((left, right) =>
          Math.abs(left.getBoundingClientRect().left + left.getBoundingClientRect().width / 2 - x)
          - Math.abs(right.getBoundingClientRect().left + right.getBoundingClientRect().width / 2 - x))[0];
        target?.focus();
        return !!target;
      }
      return focusClosestTopAction(active);
    }
    if (keyCode === 40) {
      const nextRow = rows[rowIndex + 1];
      if (nextRow) {
        const x = active.getBoundingClientRect().left + active.getBoundingClientRect().width / 2;
        const target = nextRow.slice().sort((left, right) =>
          Math.abs(left.getBoundingClientRect().left + left.getBoundingClientRect().width / 2 - x)
          - Math.abs(right.getBoundingClientRect().left + right.getBoundingClientRect().width / 2 - x))[0];
        target?.focus();
        return !!target;
      }
      if (!pagination.classList.contains('hidden')) {
        if (!nextPageButton.disabled) nextPageButton.focus();
        else if (!previousPageButton.disabled) previousPageButton.focus();
        else return false;
        return true;
      }
      if (catalogView === 'live' && !activeSeries && renderedCount < visibleChannels.length) {
        const centerX = active.getBoundingClientRect().left + active.getBoundingClientRect().width / 2;
        renderChannels(true);
        const extendedRows = visibleContentRows();
        const nextRow = extendedRows[rowIndex + 1];
        const target = nextRow?.slice().sort((left, right) =>
          Math.abs(left.getBoundingClientRect().left + left.getBoundingClientRect().width / 2 - centerX)
          - Math.abs(right.getBoundingClientRect().left + right.getBoundingClientRect().width / 2 - centerX))[0];
        if (target) { target.focus(); return true; }
      }
      if (!moreButton.classList.contains('hidden')) { moreButton.focus(); return true; }
      return false;
    }
  }

  const languageTrigger = dropdownControls.get(languageSelect)?.trigger;
  if (active === languageTrigger && keyCode === 40) {
    if (!librarySection.classList.contains('hidden')) return focusFirstContentItem();
    return focusBestGeometricCandidate(active, keyCode);
  }
  if (active === languageTrigger && keyCode === 38) return focusBestGeometricCandidate(active, keyCode);
  if (active.classList.contains('nav-button') && keyCode === 39) return focusFirstContentItem();
  if (active.classList.contains('sidebar-toggle') && keyCode === 39) return focusFirstContentItem();
  if ((keyCode === 37 || keyCode === 39) && libraryActionTargets().includes(active)) {
    return focusAdjacentLibraryAction(active, keyCode) || (keyCode === 37 && focusActiveSidebarItem());
  }
  if (active.classList.contains('dropdown-trigger') && activeDropdown) return false;
  return focusBestGeometricCandidate(active, keyCode);
}

function disconnect(): void {
  closePlayer(true);
  requestController?.abort();
  credentials = null;
  catalogCacheKey = '';
  watchScope = activeProfileId;
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
  searchInput.value = '';
  catalogPages = { movies: 1, series: 1 };
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
  updateInputProxy(serverInput);
  updateInputProxy(usernameInput);
  updateInputProxy(passwordInput);
  focusInputProxy(serverInput);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadProvider();
});
saveProviderButton.addEventListener('click', saveCurrentProvider);
providerTypeSelect.addEventListener('change', updateSourceTypeControls);
searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    if (catalogView === 'movies' || catalogView === 'series') catalogPages[catalogView] = 1;
    renderChannels();
  }, 180);
});
categorySelect.addEventListener('change', () => {
  if (catalogView === 'movies' || catalogView === 'series') catalogPages[catalogView] = 1;
  renderChannels();
});
languageSelect.addEventListener('change', applyLanguageFilter);
backToSeriesButton.addEventListener('click', () => {
  activeSeries = null;
  seriesEpisodes = [];
  updateCatalogHeading();
  renderChannels();
});
moreButton.addEventListener('click', () => renderChannels(true));
channelListScroll.addEventListener('scroll', () => {
  if (catalogView !== 'live' || activeSeries || (currentPage !== 'live' && currentPage !== 'search')) return;
  const remaining = channelListScroll.scrollHeight - channelListScroll.scrollTop - channelListScroll.clientHeight;
  if (remaining < 320 && renderedCount < visibleChannels.length) renderChannels(true);
});
previousPageButton.addEventListener('click', () => {
  if (catalogView !== 'movies' && catalogView !== 'series') return;
  catalogPages[catalogView] = Math.max(1, catalogPages[catalogView] - 1);
  renderChannels();
  focusFirstContentItem();
});
nextPageButton.addEventListener('click', () => {
  if (catalogView !== 'movies' && catalogView !== 'series') return;
  catalogPages[catalogView] = Math.min(catalogTotalPages, catalogPages[catalogView] + 1);
  renderChannels();
  focusFirstContentItem();
});
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
  if (view === 'movies' || view === 'series') catalogPages[view] = 1;
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
  if (view === 'movies' || view === 'series') catalogPages[view] = 1;
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
$('export-backup').addEventListener('click', () => { void exportSettingsBackup(); });
$('choose-backup').addEventListener('click', () => backupFileInput.click());
backupFileInput.addEventListener('change', () => {
  const file = backupFileInput.files?.[0];
  if (file) void restoreSettingsBackup(file);
});
$('refresh-diagnostics').addEventListener('click', () => { void refreshDiagnostics(); });
$('clear-cache').addEventListener('click', () => { void clearSavedCaches(); });
$('check-updates').addEventListener('click', () => { void checkForAppUpdate(); });
$('save-metadata-keys').addEventListener('click', () => {
  omdbApiKey = omdbKeyInput.value.trim();
  opensubtitlesKey = opensubtitlesKeyInput.value.trim();
  try {
    localStorage.removeItem('nextflix.tmdb-token.v1');
    if (omdbApiKey) localStorage.setItem(OMDB_API_KEY, omdbApiKey); else localStorage.removeItem(OMDB_API_KEY);
    if (opensubtitlesKey) localStorage.setItem(OPENSUBTITLES_KEY, opensubtitlesKey); else localStorage.removeItem(OPENSUBTITLES_KEY);
    metadataSettingsStatus.textContent = 'API keys saved on this TV.';
  } catch { metadataSettingsStatus.textContent = 'TV storage could not save the API keys.'; }
});
$('close-player').addEventListener('click', () => closePlayer());
previousChannelButton.addEventListener('click', () => switchChannel(-1));
nextChannelButton.addEventListener('click', () => switchChannel(1));
seekBackButton.addEventListener('click', () => seekBy(-10));
seekForwardButton.addEventListener('click', () => seekBy(10));
subtitleTracksButton.addEventListener('click', showTrackMenu);
playerLayer.addEventListener('click', () => revealPlayerControls(false));
playerLayer.addEventListener('mousemove', () => revealPlayerControls(false));
nextEpisodePlayButton.addEventListener('click', () => {
  const episode = nextEpisode;
  stopEpisodeCountdown();
  if (episode) void playVod(episode.title ?? `Episode ${episode.episode_num ?? ''}`.trim(), episode.id, episode.container_extension, 'series');
});
nextEpisodeCancelButton.addEventListener('click', () => {
  stopEpisodeCountdown();
  playerMessage.textContent = 'Episode ended.';
});
subtitleLanguagePreferencesInput.addEventListener('change', saveTrackPreferences);
playPauseButton.addEventListener('click', () => {
  if (video.paused) void video.play().catch(() => { playerMessage.textContent = 'Playback could not resume.'; });
  else { video.pause(); saveWatchProgress(true); }
});
seekBar.addEventListener('input', () => {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try { video.currentTime = (Number(seekBar.value) / Number(seekBar.max)) * duration; } catch { /* The stream may not expose a seekable range. */ }
});
video.addEventListener('loadedmetadata', () => {
  updateSeekControls();
  observeAvailableTracks();
  webOsSubtitleAdapter.start(video, () => applyPreferredTracks());
  applyPreferredTracks();
  raiseHtmlSubtitleCues();
  const generation = playbackGeneration;
  window.setTimeout(() => {
    if (generation === playbackGeneration && currentVodEntry && !subtitleTracks().length && opensubtitlesKey) void findOnlineSubtitles();
  }, 1800);
});
video.addEventListener('durationchange', updateSeekControls);
video.addEventListener('timeupdate', () => {
  updateSeekControls();
  saveWatchProgress();
});
video.addEventListener('playing', () => {
  playerMessage.textContent = '';
  if (video.parentElement === livePreview) livePreviewMessage.textContent = '';
  updatePlayPauseControl(true);
});
video.addEventListener('pause', () => updatePlayPauseControl(false));
video.addEventListener('ended', () => {
  saveWatchProgress(true, true);
  startEpisodeCountdown();
});
video.addEventListener('seeked', updateSeekControls);
video.addEventListener('waiting', () => {
  playerMessage.textContent = 'Buffering…';
  if (video.parentElement === livePreview) livePreviewMessage.textContent = 'Buffering…';
});
video.addEventListener('error', () => {
  const error = describePlaybackFailure();
  if (!playerLayer.classList.contains('hidden')) playerMessage.textContent = error;
  if (video.parentElement === livePreview) livePreviewMessage.textContent = error;
});

window.addEventListener('keydown', (event) => {
  const target = document.activeElement as HTMLElement | null;
  const keyCode = event.key === 'ArrowLeft' ? 37 : event.key === 'ArrowUp' ? 38
    : event.key === 'ArrowRight' ? 39 : event.key === 'ArrowDown' ? 40 : event.keyCode;
  const isArrow = [37, 38, 39, 40].includes(keyCode);
  const isOK = event.keyCode === 13 || event.keyCode === 23 || event.key === 'Enter' || event.key === ' ';
  const isBack = event.keyCode === 461 || event.keyCode === 10009 || event.key === 'Escape'
    || (event.key === 'Backspace' && !editingInput);

  if (editingInput) {
    if (isBack) {
      event.preventDefault();
      event.stopPropagation();
      endInputEditing();
      return;
    }
    if (isArrow) return;
  }

  if (activeDropdown) {
    if (isBack) {
      event.preventDefault();
      event.stopPropagation();
      closeDropdownSelection(false);
      return;
    }
    if (keyCode === 38 || keyCode === 40) {
      event.preventDefault();
      event.stopPropagation();
      moveDropdownHighlight(keyCode === 40 ? 1 : -1);
      return;
    }
    if (isOK && target?.classList.contains('dropdown-option')) {
      event.preventDefault();
      event.stopPropagation();
      const value = (target as HTMLButtonElement).dataset.value;
      if (value !== undefined) commitDropdownValue(activeDropdown, value);
      return;
    }
    if (keyCode === 37 || keyCode === 39) {
      event.preventDefault();
      event.stopPropagation();
      const trigger = activeDropdown.trigger;
      closeDropdownSelection(false);
      trigger.focus();
      moveDirectionalFocus(keyCode);
      return;
    }
  }

  if (isBack) {
    event.preventDefault();
    event.stopPropagation();
    handleBackPress();
    return;
  }

  if (isOK && target) {
    const proxyInput = Array.from(inputProxies.entries()).find(([, proxy]) => proxy === target)?.[0];
    if (proxyInput) {
      event.preventDefault();
      event.stopPropagation();
      beginInputEditing(proxyInput);
      return;
    }
    const dropdown = Array.from(dropdownControls.values()).find((control) => control.trigger === target);
    if (dropdown) {
      event.preventDefault();
      event.stopPropagation();
      openDropdownSelection(dropdown);
      return;
    }
  }

  if (isArrow && playerLayer.classList.contains('hidden')) {
    const searchProxy = inputProxies.get(searchInput);
    if (target === searchProxy && (keyCode === 37 || keyCode === 39)) {
      event.preventDefault();
      event.stopPropagation();
      if (keyCode === 39) focusDropdownTrigger(categorySelect);
      else if (!languageFilter.classList.contains('hidden')) focusDropdownTrigger(languageSelect);
      else focusActiveSidebarItem();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    moveDirectionalFocus(keyCode);
    return;
  }

  if (playerLayer.classList.contains('hidden')) return;
  if (playerLayer.classList.contains('controls-hidden') && !openTrackMenu) {
    revealPlayerControls(false);
    playPauseButton.focus();
  } else {
    revealPlayerControls(false);
  }
  if ([37, 38, 39, 40].includes(keyCode)) {
    if ((keyCode === 37 || keyCode === 39) && target === seekBar) {
      event.preventDefault();
      event.stopPropagation();
      beginSeekHold(keyCode === 37 ? -1 : 1);
      return;
    }
    if (keyCode === 37 || keyCode === 39) {
      event.preventDefault();
      event.stopPropagation();
      if (!movePlayerControlFocus(keyCode)) moveDirectionalFocus(keyCode);
      return;
    }
    if (keyCode === 38 || keyCode === 40) {
      if (moveDirectionalFocus(keyCode)) event.preventDefault();
      else event.preventDefault();
      event.stopPropagation();
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

window.addEventListener('keyup', (event) => {
  if (event.keyCode === 37 || event.keyCode === 39 || event.key === 'ArrowLeft' || event.key === 'ArrowRight') stopSeekHold();
});

$('stay-button').addEventListener('click', closeExitPrompt);
$('exit-button').addEventListener('click', exitApplication);
$('close-profiles').addEventListener('click', closeProfilesDialog);
$('add-profile').addEventListener('click', addViewerProfile);
profileSwitchButton.addEventListener('click', openProfilesDialog);

try {
  initializeProfiles();
  watchScope = activeProfileId;
  loadFavoritesForProfile(true);
  sidebar.classList.toggle('collapsed', localStorage.getItem('nextflix.sidebar-collapsed.v1') === 'true');
} catch { /* Defaults are used when local storage is unavailable. */ }
loadWatchHistory();
try {
  localStorage.removeItem('nextflix.tmdb-token.v1');
  omdbApiKey = localStorage.getItem(OMDB_API_KEY) ?? '';
  opensubtitlesKey = localStorage.getItem(OPENSUBTITLES_KEY) ?? '';
  omdbKeyInput.value = omdbApiKey;
  opensubtitlesKeyInput.value = opensubtitlesKey;
} catch { /* Optional API keys remain unavailable when local storage is blocked. */ }
populateLanguagePreferences();
loadTrackPreferencesForProfile();

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

setupDropdowns();
setupInputProxies();
installScrollCues();

