# av5ja discord bot

Discord bot client for SplatNet3.

> This repository does not contain any contenes copyrighted by Nintendo Co., Ltd.

## Features

- Sign in with Nintendo Switch Online account with Third party API
- Download salmon run results from SpaltNet3
- Upload salmon run results to [Salmon Stats](https://api.splatnet3.com/v3/docs)

> Authentication using external APIs may cause a ban.

## How to use

Find out your discord bot token and secret on [Discord Developer Portal](https://discord.com/developers/applications) and set it `.env`.

```zsh
API_URL=https://api.splatnet3.com # Salmon Stats Server URL
BOT_VERSION=1.0.0b
AV5JA_DISCORD_APPLICATION_ID= # Discord Bot ID
AV5JA_DISCORD_APPLICATION_SECRET= # Discord Bot Secret
AV5JA_DISCORD_GUILD_ID= # Discord Server ID
NODE_ENV=production # production or development
VERSION=2.9.0 # Overwrite X-Product Version (Optional)
```

### Git

```zsh
git clone https://github.com/salmonstats3/av5ja_discord_bot
cd av5ja_discord_bot
bun install
bun dev
```

This project was created using `bun init` in bun v1.0.26. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

### Docker (Recommend)

make a `docker-compose.yaml` following below format.

```yaml
version: '3.9'

services:
  av5ja_discord_bot:
    image: tkgling/av5ja_discord_bot:latest
    container_name: av5ja-discord-bot
    restart: always
    environment:
      API_URL: $API_URL
      BOT_VERSION: $BOT_VERSION
      DISCORD_APPLICATION_ID: $AV5JA_DISCORD_APPLICATION_ID
      DISCORD_APPLICATION_SECRET: $AV5JA_DISCORD_APPLICATION_SECRET
      DISCORD_GUILD_ID: $AV5JA_DISCORD_GUILD_ID
      NODE_ENV: $NODE_ENV
      VERSION: $VERSION
```

then, launch app with `docker compose up -d`.
