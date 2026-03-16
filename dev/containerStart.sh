#!/bin/zsh

set -a
source .env
set +a

export PATH="/pnpm:$PATH"

# Make the `host` command available for container-to-host IPC
ln -sf "$(pwd)/dev/host" /usr/local/bin/host
ln -sf "$(pwd)/dev/zshrc.dev" /root/.zshrc
ln -sf "$(pwd)/dev/zshenv.dev" /root/.zshenv

# Wire up xdg-open to open URLs on the host machine's browser via the IPC bridge.
# This container has no desktop environment, so xdg-open would fail otherwise.
printf '#!/bin/sh\nexec host open-browser --url "$1"\n' > /usr/local/bin/xdg-open
chmod +x /usr/local/bin/xdg-open

aws configure set region $AWS_DEFAULT_REGION
aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

gh_token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -n "$gh_token" ]; then
  unset GITHUB_TOKEN
  printf '%s' "$gh_token" | gh auth login --hostname github.com --with-token
fi

# Use the latest version of coding agents, but try to make this fast if they're already in the cache
agent_tools=(opencode-ai @mariozechner/pi-coding-agent @anthropic-ai/claude-code @openai/codex)
installed_tools_json="$(pnpm list -g --depth 0 --json)"
for tool in ${agent_tools}; do
  installed_version="$(printf '%s' "$installed_tools_json" | node -e 'let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { let pkg = process.argv[1]; let rows = JSON.parse(input); let deps = {...(rows[0]?.dependencies || {}), ...(rows[0]?.devDependencies || {})}; process.stdout.write(deps[pkg]?.version || "") })' "$tool")"
  latest_version="$(pnpm view "$tool" version 2>/dev/null || true)"
  if [ -z "$latest_version" ] || [ "$installed_version" = "$latest_version" ]; then
    continue
  fi
  echo "Updating $tool ($installed_version -> $latest_version)"
  pnpm add -g --prefer-offline --allow-build=koffi --allow-build=opencode-ai --allow-build=protobufjs "$tool@$latest_version"
done

# install packages
pnpm install --prefer-offline
(cd cloud && pnpm install --prefer-offline)
(cd core && pnpm install --prefer-offline)
