/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XTREAM_URL?: string;
  readonly VITE_XTREAM_USERNAME?: string;
  readonly VITE_XTREAM_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
