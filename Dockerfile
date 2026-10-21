FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/scripts/migrate.mjs /app/scripts/account.mjs ./scripts/
COPY --from=build --chown=app:app /app/lib/password.mjs ./lib/password.mjs
COPY --from=build --chown=app:app /app/db/migrations ./db/migrations
USER app
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]

