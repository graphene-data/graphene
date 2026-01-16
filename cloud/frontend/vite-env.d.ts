/// <reference types="vite/client" />

// eslint-disable-next-line svelte/no-svelte-internal
import type internal from 'svelte/internal'
import {type SvelteComponent} from 'svelte'

declare module '@stytch/vanilla-js/b2b';

interface GrapheneGlobal {
  components?: Record<string, SvelteComponent>;
  svelte?: typeof internal;
  [key: string]: unknown;
}

declare global {
  interface Window {
    $GRAPHENE: GrapheneGlobal;
  }
}

export {}
