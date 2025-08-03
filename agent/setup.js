#!/usr/bin/env zx

const SCRIPT_DIR = path.dirname(process.argv[1]);
cd(SCRIPT_DIR);

await $`ln -s ../agent.md ../CLAUDE.md`;

cd('-');
