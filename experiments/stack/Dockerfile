ARG NODE_IMAGE=node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
FROM ${NODE_IMAGE}
WORKDIR /lab
COPY package.json package-lock.json ./
RUN apk upgrade --no-cache
RUN npm ci --ignore-scripts --no-audit --no-fund --strict-peer-deps \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY src ./src
COPY upstream ./upstream
COPY migrations ./migrations
COPY tsconfig.json eslint.config.mjs ./
RUN mkdir results
CMD ["node", "--test", "src/*.test.ts"]
