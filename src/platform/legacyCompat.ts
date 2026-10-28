// Small runtime shims for older LG webOS engines (Chromium 53 on webOS 4.x).
const objectWithEntries = Object as any;

if (typeof objectWithEntries.entries !== 'function') {
  objectWithEntries.entries = (value: Record<string, unknown>) => Object.keys(value).map((key) => [key, value[key]]);
}

const legacyWindow = window as any;
if (typeof legacyWindow.AbortController !== 'function' && typeof legacyWindow.fetch === 'function') {
  const nativeFetch = legacyWindow.fetch.bind(window);
  const abortError = () => {
    const error = new Error('The request was aborted.');
    error.name = 'AbortError';
    return error;
  };

  legacyWindow.AbortController = function LegacyAbortController() {
    const listeners: Array<() => void> = [];
    const signal = {
      aborted: false,
      addEventListener(type: string, listener: () => void) {
        if (type === 'abort' && listeners.indexOf(listener) < 0) listeners.push(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        if (type !== 'abort') return;
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }
    };
    this.signal = signal;
    this.abort = () => {
      if (signal.aborted) return;
      signal.aborted = true;
      listeners.slice().forEach((listener) => listener());
      listeners.length = 0;
    };
  };

  legacyWindow.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = (init as any)?.signal;
    if (!signal || typeof signal.addEventListener !== 'function') return nativeFetch(input, init);
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise<Response>((resolve, reject) => {
      let settled = false;
      const finish = (callback: (value: any) => void, value: any) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback(value);
      };
      const onAbort = () => finish(reject, abortError());
      signal.addEventListener('abort', onAbort);
      nativeFetch(input, init).then(
        (response: Response) => finish(resolve, response),
        (error: unknown) => finish(reject, error)
      );
    });
  };
}

