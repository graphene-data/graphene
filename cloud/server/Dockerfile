FROM node:24-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY core/package.json core/pnpm-lock.yaml core/pnpm-workspace.yaml ./core/
COPY core/lang/package.json ./core/lang/
COPY core/ui/package.json ./core/ui/
COPY core/cli/package.json ./core/cli/
RUN cd core && pnpm install --prefer-frozen-lockfile --prod

COPY cloud/package.json cloud/pnpm-lock.yaml ./cloud/
RUN cd cloud && pnpm install --prefer-frozen-lockfile --prod

# Clean up pnpm store and cache (saves ~600MB)
RUN rm -rf /pnpm /root/.local /root/.cache

COPY core ./core
COPY cloud ./cloud

EXPOSE 3000

WORKDIR /app/cloud
ENV NODE_ENV=production
CMD ["node", "server/server.ts"]
