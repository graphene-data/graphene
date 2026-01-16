import {vitePreprocess} from '@sveltejs/vite-plugin-svelte'

const config = {
  compilerOptions: {
    // eslint-disable-next-line no-undef
    dev: process.env.NODE_ENV !== 'production',
  },
  preprocess: [vitePreprocess()],
}

export default config
