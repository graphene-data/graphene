/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STYTCH_PUBLIC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@stytch/vanilla-js/b2b';

type GrapheneComponentCtor = typeof import('svelte').SvelteComponent;

interface GrapheneGlobal {
  components?: Record<string, GrapheneComponentCtor>;
  svelte?: typeof import('svelte/internal');
  [key: string]: unknown;
}

interface Window {
  $GRAPHENE?: GrapheneGlobal;
}
