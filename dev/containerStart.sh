set -a
source .env
set +a

# Make the `host` command available for container-to-host IPC
ln -sf "$(pwd)/dev/host" /usr/local/bin/host
ln -sf "$(pwd)/dev/zshrc.dev" /root/.zshrc

# Wire up xdg-open to open URLs on the host machine's browser via the IPC bridge.
# This container has no desktop environment, so xdg-open would fail otherwise.
printf '#!/bin/sh\nexec host open-browser --url "$1"\n' > /usr/local/bin/xdg-open
chmod +x /usr/local/bin/xdg-open

aws configure set region $AWS_DEFAULT_REGION
aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

opencode upgrade

pnpm install
(cd cloud && pnpm --force install)
(cd core && pnpm --force install)
