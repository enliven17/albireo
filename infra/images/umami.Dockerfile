FROM ghcr.io/umami-software/umami:3.5.0@sha256:b64f40400d77bcadd39cf5c62a1e368c99524ca442024f96e1133355a19a5dbc AS upstream
FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS patch
RUN npm install --prefix /patch --ignore-scripts --no-audit --no-fund fast-uri@3.1.9

# Patch the shipped artifact in place, retaining upstream app/schema and ownership.
FROM upstream
USER root
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=patch /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
RUN test "$(node -p "require('./node_modules/.pnpm/fast-uri@3.1.8/node_modules/fast-uri/package.json').version")" = 3.1.8 \
    && rm -rf node_modules/.pnpm/fast-uri@3.1.8/node_modules/fast-uri
# Keep upstream pnpm symlinks intact; the package content/version is now 3.1.9.
COPY --from=patch /patch/node_modules/fast-uri /app/node_modules/.pnpm/fast-uri@3.1.8/node_modules/fast-uri
USER nextjs
