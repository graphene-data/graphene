

import chalk from 'chalk';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';
import { analyze } from '@graphene/lang';

const increaseNodeMemoryLimit = () => {
	// Don't override the memory limit if it's already set
	if (process.env.NODE_OPTIONS?.includes('--max-old-space-size')) return;
	process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`;
};

const loadEnvFile = () => {
	const envFile = loadEnv('', '.', ['EVIDENCE_', 'VITE_']);
	Object.assign(process.env, envFile);
};

const populateTemplate = function () {
	clearQueryCache();

	// Create the template project in .evidence/template
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	fs.ensureDirSync('./.evidence/template/');

	// empty the template directory, except:
	// - local settings
	// - telemetry profile
	// - static folder (mainly to preserve the data directory)
	const keepers = new Set(['.profile.json', 'static', '.evidence-queries']);
	fs.readdirSync('./.evidence/template/').forEach((file) => {
		if (!keepers.has(file)) fs.removeSync(path.join('./.evidence/template/', file));
	});

	fs.copySync(path.join(__dirname, '../node_modules/@evidence-dev/evidence/template'), './.evidence/template/');

	// graphene-specific overrides
	fs.copySync(path.join(__dirname, '+layout.js'), './.evidence/template/src/pages/+layout.js')
	fs.copySync(path.join(__dirname, 'vite.config.js'), './.evidence/template/vite.config.js')
};

const clearQueryCache = function () {
	fs.removeSync('.evidence/template/.evidence-queries/cache');
};

const runFileWatcher = function (watchPatterns) {
	const ignoredFiles = [
		'./pages/explore/**',
		'./pages/explore.+(*)',
		'./pages/settings/**',
		'./pages/settings.+(*)',
		'./pages/api/**',
		'./pages/api.+(*)'
	];

	var watchers = [];

	watchPatterns.forEach((pattern, item) => {
		watchers[item] = chokidar.watch(path.join(pattern.sourceRelative, pattern.filePattern), {
			ignored: ignoredFiles
		});

		const sourcePath = (p) => path.join('./', p);
		const targetPath = (p) =>
			path.join(pattern.targetRelative, path.relative(pattern.sourceRelative, p));
		const pagePath = (p) =>
			p.includes('pages')
				? p.endsWith('index.md')
					? p.replace('index.md', '+page.md')
					: p.replace('.md', '/+page.md')
				: p;

		const syncFile = (file) => {
			const source = sourcePath(file);
			const target = targetPath(source);
			const svelteKitPagePath = pagePath(target);
			fs.copySync(source, svelteKitPagePath);
		};

		const unlinkFile = (file) => {
			const source = sourcePath(file);
			const target = targetPath(source);
			const svelteKitPagePath = pagePath(target);
			fs.removeSync(svelteKitPagePath);
		};

		watchers[item]
			.on('add', syncFile)
			.on('change', syncFile)
			.on('unlink', unlinkFile)
			.on('addDir', (path) => {
				fs.ensureDirSync(targetPath(path));
			})
			.on('unlinkDir', (path) => fs.removeSync(targetPath(path)));
	});
	return watchers;
};

const flattenArguments = function (args) {
	if (args) {
		const result = [];
		const keys = Object.keys(args);
		keys.forEach((key) => {
			if (key !== '_' && args[key] !== undefined) {
				result.push(`--${key}`);
				if (args[key] && args[key] !== true) {
					result.push(args[key]);
				}
			}
		});
		return result;
	} else {
		return [];
	}
};

const watchPatterns = [
	{
		sourceRelative: './pages/',
		targetRelative: './.evidence/template/src/pages/',
		filePattern: '**'
	}, // markdown pages
	{
		sourceRelative: './static/',
		targetRelative: './.evidence/template/static/',
		filePattern: '**'
	}, // static files (eg images)
	{
		sourceRelative: './sources/',
		targetRelative: './.evidence/template/sources/',
		filePattern: '**'
	}, // source files (eg csv files)
	{
		sourceRelative: './queries',
		targetRelative: './.evidence/template/queries',
		filePattern: '**'
	},
	{
		sourceRelative: './components/',
		targetRelative: './.evidence/template/src/components/',
		filePattern: '**'
	}, // custom components
	{ sourceRelative: '.', targetRelative: './.evidence/template/src/', filePattern: 'app.css' }, // custom theme file
	{
		sourceRelative: './partials',
		targetRelative: './.evidence/template/partials',
		filePattern: '**'
	}
];

export function serve () {
  increaseNodeMemoryLimit();
  loadEnvFile();

	const manifestExists = fs.lstatSync(
		path.join('.evidence', 'template', 'static', 'data', 'manifest.json'),
		{ throwIfNoEntry: false }
	);
	if (!manifestExists) {
		console.warn(
			chalk.yellow(
				`
${chalk.bold('[!] Unable to load source manifest')}
This likely means you have no source data, and need to generate it.
Running ${chalk.bold('npm run sources')} will generate the needed data. See ${chalk.bold(
	'npm run sources --help'
)} for more usage information
Documentation: https://docs.evidence.dev/core-concepts/data-sources/
	`.trim()
			)
		);
	}

	populateTemplate();

	const watchers = runFileWatcher(watchPatterns);
	const flatArgs = flattenArguments([]);

	// Run svelte kit dev in the hidden directory
	const child = spawn(`tsx --inspect ../../node_modules/vite/bin/vite.js dev --port 3000`, flatArgs, {
		shell: true,
		detached: false,
		cwd: '.evidence/template',
		stdio: 'inherit',
	});

	child.on('exit', function () {
		child.kill();
		watchers.forEach((watcher) => watcher.close());
	});
}
