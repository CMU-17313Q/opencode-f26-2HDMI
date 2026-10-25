FROM oven/bun:1.3.14

# git/python/build tools are needed by native dependency postinstall scripts (node-pty)
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

WORKDIR /app/packages/opencode
EXPOSE 4096

# Bind to all interfaces inside the container; compose only publishes it on 127.0.0.1
CMD ["bun", "run", "--conditions=browser", "./src/index.ts", "web", "--hostname", "0.0.0.0", "--port", "4096"]
