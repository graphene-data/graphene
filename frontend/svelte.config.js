import {vitePreprocess} from '@sveltejs/vite-plugin-svelte'

const config = {
  compilerOptions: {
    dev: process.env.NODE_ENV !== 'production',
  },
  preprocess: [vitePreprocess()],
}

export default config
