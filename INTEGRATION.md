# IrfanLM Tools 8.1.0 + Railway Relay Integration

## What changed

The exact user-supplied `IrfanLM-Tools-v8-with-connection-panel(2).zip` is the extension base. The integrated build keeps its NotebookLM discovery and Studio parsing logic, but changes the Telegram and Cloudinary export paths so the extension never downloads the large media file and never stores the Telegram bot token or Cloudinary API secret.

The bulk panel now has **Railway Relay Settings** for the Railway HTTPS URL, `AUTH_SECRET`, and Telegram chat ID. These values are stored under `__bulkTools_relayCreds`. Saving the settings deletes legacy `__bulkTools_cloudinaryCreds` and `__bulkTools_telegramCreds` entries.

Before each item is delivered, the extension refreshes its NotebookLM media URL using the existing notebook RPC logic. It then sends an authenticated JSON request with `X-Relay-Token` to `/telegram/send` or `/cloudinary/upload`. The body contains the signed URL and item metadata only.

## Deployment

1. Deploy the contents of `railway-relay/` to a private GitHub repository and connect that repository to Railway.
2. Set `AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`. Add the three Cloudinary variables if Cloudinary export is required.
3. Copy the Railway HTTPS domain.
4. Extract `IrfanLM-Tools-v8.1.0-with-railway-relay.zip` and load the extracted directory through `chrome://extensions` → **Developer mode** → **Load unpacked**.
5. Open the extension’s bulk Studio panel, enter the Railway URL, the matching `AUTH_SECRET`, and Telegram chat ID under **Railway Relay Settings**, then save.

## Packages

`IrfanLM-Tools-v8.1.0-with-railway-relay.zip` contains only the browser extension.

`irfanlm-relay-railway.zip` contains the Railway Node/Express service, including `server.js`, authenticated Telegram and Cloudinary routes, URL validation middleware, `package.json`, `railway.toml`, `.env.example`, and README deployment instructions. It excludes `node_modules` and local secrets.

## Important limitation

The relay must receive each signed NotebookLM URL immediately. The integrated extension intentionally uses the single-item endpoint for per-item progress and to avoid queuing URLs until they expire. If Railway restarts while an item is being processed, that item will be marked failed and can be retried.
