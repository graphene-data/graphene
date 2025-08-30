import evidencePreprocess from '@evidence-dev/preprocess';
import adapter from '@sveltejs/adapter-static';
import { addBasePathToHrefAndSrc, injectComponents } from '@evidence-dev/sdk/build/svelte';
import { getEvidenceConfig } from '@evidence-dev/sdk/config';
const evidenceConfig = getEvidenceConfig();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [...evidencePreprocess(true), injectComponents(), addBasePathToHrefAndSrc],
	// onwarn: errorHandler,
	kit: {
		adapter: adapter({
			pages: process.env.EVIDENCE_BUILD_DIR ?? './build',
			strict: false
		}),
		files: {
			routes: 'src/pages',
			lib: 'src/components'
		},
		paths: {
			base: evidenceConfig.deployment.basePath,
			relative: false
		},
		serviceWorker: {
			register: false
		}
	}
};

export default config
