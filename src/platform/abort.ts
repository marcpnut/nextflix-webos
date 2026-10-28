export function createAbortController(): AbortController {
  const legacyWindow = window as unknown as { AbortController?: new () => AbortController };
  if (typeof legacyWindow.AbortController === 'function') return new legacyWindow.AbortController();

  // legacyCompat installs a fetch wrapper when Chromium 53 lacks AbortController.
  // It rejects the app-facing request on abort; the old engine may finish the
  // underlying network transfer because it cannot cancel that transport.
  return {
    signal: undefined as unknown as AbortSignal,
    abort: () => undefined
  } as AbortController;
}
