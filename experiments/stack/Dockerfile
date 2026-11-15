ARG NODE_VERSION=24.19.0
FROM node:${NODE_VERSION}-bookworm
WORKDIR /lab
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund --strict-peer-deps
COPY src ./src
COPY upstream ./upstream
COPY migrations ./migrations
COPY tsconfig.json eslint.config.mjs ./
RUN mkdir results
CMD ["npm", "test"]
