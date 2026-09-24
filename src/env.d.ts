interface ImportMetaEnv {
  /** Хост API GREEN-API; задаётся, если инстанс живёт на выделенном сервере. */
  readonly VITE_GREEN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
