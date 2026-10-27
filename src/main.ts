import './style.css';

type XtreamAuth = {
  user_info?: { auth?: number; status?: string; exp_date?: string | null };
  server_info?: { url?: string; port?: string; https_port?: string; server_protocol?: string };
};

type Category = { category_id?: string | number; category_name?: string };
type Channel = {
  num?: number | string;
  name?: string;
  stream_id: number | string;
  stream_icon?: string;
  category_id?: string | number;
  epg_channel_id?: string;
};

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing app element: ${id}`);
  return element as T;
};

const form = $('connect-form') as HTMLFormElement;
const serverInput = $('server') as HTMLInputElement;
const usernameInput = $('username') as HTMLInputElement;
const passwordInput = $('password') as HTMLInputElement;
const togglePasswordButton = $('toggle-password') as HTMLButtonElement;
const rememberProviderInput = $('remember-provider') as HTMLInputElement;
const formatInput = $('format') as HTMLSelectElement;
const connectButton = $('connect-button') as HTMLButtonElement;
const message = $('message');
const stateLabel = $('connection-state');
const setupSection = $('setup');
const librarySection = $('library');
const categorySelect = $('category') as HTMLSelectElement;
const channelList = $('channel-list');
const moreButton = $('more-button') as HTMLButtonElement;
const playerLayer = $('player');
const video = $('video') as HTMLVideoElement;
const playerMessage = $('player-message');
const playingTitle = $('playing-title');
const playPauseButton = $('play-pause') as HTMLButtonElement;

const PAGE_SIZE = 72;
const REMEMBERED_PROVIDER_KEY = 'nextflix.xtream.provider.v1';
type SavedProvider = { base: string; username: string; password: string; format: 'ts' | 'm3u8' };
let credentials: { base: string; username: string; password: string } | null = null;
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

function setBusy(busy: boolean): void {
  connectButton.disabled = busy;
  connectButton.textContent = busy ? 'Connecting…' : 'Connect and load channels';
  form.setAttribute('aria-busy', String(busy));
  message.classList.toggle('loading', busy);
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
      format: saved.format === 'm3u8' ? 'm3u8' : 'ts'
    };
  } catch {
    return null;
  }
}

function saveProvider(saved: SavedProvider): boolean {
  try {
    localStorage.setItem(REMEMBERED_PROVIDER_KEY, JSON.stringify(saved));
    return true;
  } catch {
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

async function api<T>(action?: string, extra: Record<string, string> = {}): Promise<T> {
  if (!credentials) throw new Error('Connect to a provider first.');
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const timeout = window.setTimeout(() => controller.abort(), 15000);
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

async function loadProvider(): Promise<void> {
  setBusy(true);
  setMessage('Checking provider URL…');
  try {
    const base = normalizedBase(serverInput.value);
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) throw new Error('Enter both username and password.');
    credentials = { base, username, password };

    setMessage('Checking your provider login…');
    const auth = await api<XtreamAuth>();
    assertAuthenticated(auth);
    let categoryWarning = '';
    setMessage('Login accepted. Loading categories…');
    const categoryResponse = await api<Category[]>('get_live_categories').catch(() => {
      categoryWarning = 'Categories are unavailable; showing channels without category names. ';
      return [] as Category[];
    });
    categories = Array.isArray(categoryResponse) ? categoryResponse : [];
    if (rememberProviderInput.checked && !saveProvider({ base, username, password, format: formatInput.value === 'm3u8' ? 'm3u8' : 'ts' })) {
      categoryWarning += 'TV storage could not save the login. ';
    }

    setMessage('Login accepted. Loading live channels…');
    const channelResponse = await api<Channel[]>('get_live_streams');
    if (!Array.isArray(channelResponse)) throw new Error('Provider returned an invalid live channel list.');
    channels = channelResponse.filter((channel) => channel && channel.stream_id !== undefined && channel.name);
    if (!channels.length) throw new Error('The provider account has no live channels.');

    categorySelect.replaceChildren(new Option('All categories', 'all'));
    for (const category of categories) {
      if (category.category_id === undefined || !category.category_name) continue;
      categorySelect.add(new Option(category.category_name, String(category.category_id)));
    }
    stateLabel.textContent = `${channels.length} channels`;
    setupSection.classList.add('hidden');
    librarySection.classList.remove('hidden');
    passwordInput.value = '';
    setMessage(categoryWarning);
    renderChannels();
    channelList.querySelector<HTMLButtonElement>('button')?.focus();
  } catch (error) {
    credentials = null;
    const safeMessage = error instanceof Error ? error.message : 'Connection failed.';
    setMessage(safeMessage, true);
    stateLabel.textContent = 'Not connected';
  } finally {
    setBusy(false);
  }
}

function renderChannels(append = false): void {
  const category = categorySelect.value;
  visibleChannels = channels.filter((channel) => category === 'all' || String(channel.category_id ?? '') === category);
  if (!append) {
    renderedCount = 0;
    channelList.replaceChildren();
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
    button.append(number, name);
    button.addEventListener('click', () => playChannel(channel));
    fragment.append(button);
  }
  channelList.append(fragment);
  renderedCount += next.length;
  moreButton.classList.toggle('hidden', renderedCount >= visibleChannels.length);
  if (!visibleChannels.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No channels in this category.';
    channelList.append(empty);
  }
}

function streamUrl(channel: Channel): string {
  if (!credentials) throw new Error('Provider is disconnected.');
  const ext = formatInput.value === 'm3u8' ? 'm3u8' : 'ts';
  const path = ['live', credentials.username, credentials.password, `${channel.stream_id}.${ext}`]
    .map((part) => encodeURIComponent(part)).join('/');
  return `${credentials.base}/${path}`;
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
  } catch {
    playerMessage.textContent = 'Playback did not start. Try the other Live format or check provider compatibility.';
  }
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
  categories = [];
  channels = [];
  visibleChannels = [];
  renderedCount = 0;
  categorySelect.replaceChildren(new Option('All categories', 'all'));
  channelList.replaceChildren();
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
togglePasswordButton.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePasswordButton.textContent = show ? 'Hide' : 'Show';
  togglePasswordButton.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  togglePasswordButton.setAttribute('aria-pressed', String(show));
});
rememberProviderInput.addEventListener('change', () => {
  if (!rememberProviderInput.checked) forgetProvider();
});
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
  if (!playerLayer.classList.contains('hidden')) playerMessage.textContent = 'Stream error. Try another format or channel.';
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
if (savedProvider) {
  rememberProviderInput.checked = true;
  serverInput.value = savedProvider.base;
  usernameInput.value = savedProvider.username;
  passwordInput.value = savedProvider.password;
  formatInput.value = savedProvider.format;
  setMessage('Reconnecting with the login saved on this TV…');
  window.setTimeout(() => { void loadProvider(); }, 300);
}

