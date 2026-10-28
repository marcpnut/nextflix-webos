export type WebOsSubtitleTrack = {
  index: number;
  language?: string;
  label: string;
};

type LunaResponse = {
  returnValue?: boolean;
  errorText?: string;
  sourceInfo?: {
    programInfo?: Array<{
      subtitleTrackInfo?: Array<{ language?: string; label?: string; name?: string }>;
    }>;
  };
};

type LunaRequest = {
  method: string;
  parameters: Record<string, unknown>;
  onSuccess: (response: LunaResponse) => void;
  onFailure: (error: { errorText?: string }) => void;
};

type LunaHandle = { cancel?: () => void };
type WebOsHost = Window & {
  webOS?: { service?: { request: (uri: string, request: LunaRequest) => LunaHandle | undefined } };
};
type MediaIdVideo = HTMLVideoElement & { mediaId?: string };

/** Optional bridge for LG's media service; native HTML textTracks remain the fallback. */
export class WebOsMediaSubtitleAdapter {
  private mediaId = '';
  private generation = 0;
  private retryTimer = 0;
  private subscription: LunaHandle | undefined;
  private tracks: WebOsSubtitleTrack[] = [];

  get availableTracks(): WebOsSubtitleTrack[] {
    return this.tracks;
  }

  start(video: HTMLVideoElement, onTracks: (tracks: WebOsSubtitleTrack[]) => void): void {
    this.stop();
    const generation = this.generation;
    let attempts = 0;
    const trySubscribe = (): void => {
      if (generation !== this.generation) return;
      const host = window as WebOsHost;
      const mediaId = (video as MediaIdVideo).mediaId;
      if (!host.webOS?.service?.request || !mediaId || mediaId === '<invalid mediaId>') {
        if (attempts++ < 12) this.retryTimer = window.setTimeout(trySubscribe, 500);
        return;
      }
      this.mediaId = mediaId;
      try {
        this.subscription = host.webOS.service.request('luna://com.webos.media', {
          method: 'subscribe',
          parameters: { subscribe: true, mediaId },
          onSuccess: (response) => {
            if (generation !== this.generation) return;
            const entries = response.sourceInfo?.programInfo?.[0]?.subtitleTrackInfo ?? [];
            this.tracks = entries.map((entry, index) => ({
              index,
              language: entry.language?.trim() || undefined,
              label: entry.label?.trim() || entry.name?.trim() || entry.language?.trim() || `Subtitle ${index + 1}`
            }));
            onTracks(this.tracks);
          },
          onFailure: () => {
            if (generation === this.generation) {
              this.tracks = [];
              onTracks(this.tracks);
            }
          }
        });
      } catch {
        this.tracks = [];
        onTracks(this.tracks);
      }
    };
    trySubscribe();
  }

  async select(index: number | null): Promise<void> {
    const host = window as WebOsHost;
    const service = host.webOS?.service;
    if (!service || !this.mediaId) throw new Error('The TV subtitle service is unavailable for this stream.');
    if (index === null) {
      await this.request(service, 'setSubtitleEnable', { enable: false, mediaId: this.mediaId });
      return;
    }
    await this.request(service, 'setSubtitleEnable', { enable: true, mediaId: this.mediaId });
    await this.request(service, 'selectTrack', { type: 'text', mediaId: this.mediaId, index });
  }

  stop(): void {
    this.generation += 1;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    try { this.subscription?.cancel?.(); } catch { /* Some webOS builds do not expose cancellation. */ }
    this.subscription = undefined;
    this.mediaId = '';
    this.tracks = [];
  }

  private request(
    service: NonNullable<NonNullable<WebOsHost['webOS']>['service']>,
    method: string,
    parameters: Record<string, unknown>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        service.request('luna://com.webos.media', {
          method,
          parameters,
          onSuccess: (response) => response.returnValue === false
            ? reject(new Error(response.errorText || `${method} was rejected by the TV.`))
            : resolve(),
          onFailure: (error) => reject(new Error(error.errorText || `${method} failed on the TV.`))
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`${method} failed on the TV.`));
      }
    });
  }
}
