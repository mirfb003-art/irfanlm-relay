# IrfanLM Relay Server

This Railway service works with **IrfanLM Tools v8 with Connection Panel**. The extension obtains a fresh signed NotebookLM Studio media URL, then sends only a small authenticated JSON request to this server. Railway fetches the large media file using its own connection and delivers it to Telegram or Cloudinary.

## End-to-end flow

```text
NotebookLM gArtLc RPC
        │ fresh signed mediaUrl
        ▼
IrfanLM extension background worker
        │ HTTPS JSON + X-Relay-Token
        ▼
Railway IrfanLM Relay
        ├── fetches media server-side
        ├── streams it to Telegram
        └── uploads it to Cloudinary
```

The extension refreshes each URL immediately before delivery because NotebookLM URLs are short-lived. The phone/browser does not download the audio/video file. Telegram and Cloudinary secrets remain in Railway environment variables. For Telegram, Railway first writes the complete upstream response to temporary disk, verifies it is non-empty media, and uploads it with a known byte length; this prevents zero-duration or truncated Telegram files.

## Railway variables

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_SECRET` | Yes | Long random secret entered in the extension as Relay Token. |
| `TELEGRAM_BOT_TOKEN` | Telegram | BotFather token; never enter it in the extension. |
| `TELEGRAM_CHAT_ID` | Optional | Default Telegram destination. The extension may send its configured chat ID. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Cloudinary | Cloudinary secret; stays only on Railway. |
| `PORT` | No | Railway supplies this automatically. |

Create a secret with `openssl rand -hex 32`.

## Endpoints

All endpoints except `GET /` require:

```text
X-Relay-Token: <AUTH_SECRET>
```

`GET /` is a public health check. `GET /status` is authenticated and reports only whether Telegram and Cloudinary are configured.

`POST /telegram/send` accepts one item:

```json
{
  "mediaUrl": "https://notebooklm.google.com/signed-media-url",
  "title": "My Studio Episode",
  "type": "1",
  "chatId": "-1001234567890",
  "caption": "Optional caption"
}
```

Type `1` is Audio and `3` is Video. The server validates the URL, fetches it through Railway, streams it into Telegram `sendAudio` or `sendVideo`, and returns `{ "success": true, "messageId": 42, "title": "..." }`.

`POST /telegram/send-bulk` accepts up to 50 items and processes them sequentially with a three-second gap. The integrated extension uses the single-item endpoint so it receives per-item success/failure in its existing queue UI.

`POST /cloudinary/upload` accepts the same `mediaUrl`, title, and type plus an optional folder. Cloudinary fetches the URL server-side using the Railway-only Cloudinary credentials.

## Configure the exact extension

1. Deploy this repository to Railway and copy its HTTPS URL.
2. Open the updated extension’s bulk Studio panel.
3. Choose **Railway Relay Settings**.
4. Enter the Railway URL, the same `AUTH_SECRET` as Relay Token, and the Telegram chat ID.
5. Save the settings.
6. Open a NotebookLM notebook, load ready Audio/Video Studio items, and choose **Send Selected to Telegram** or **Export Selected to Cloudinary**.

The extension stores only this relay configuration under `__bulkTools_relayCreds`:

```json
{
  "relayServerUrl": "https://your-app.up.railway.app",
  "relayToken": "your_AUTH_SECRET",
  "telegramChatId": "-1001234567890"
}
```

Saving relay settings removes old extension-side Cloudinary and Telegram credential keys. Do not enter `TELEGRAM_BOT_TOKEN`, `CLOUDINARY_API_SECRET`, or any other third-party secret into the extension.

## Deploy and test

Push the contents of this directory to GitHub, deploy the repository in Railway, add the variables above, and use the generated HTTPS domain. For local development:

```bash
cp .env.example .env
npm install
npm start
curl http://localhost:3000/
curl http://localhost:3000/status -H "X-Relay-Token: your_AUTH_SECRET"
```

## Security behavior

The server requires the shared relay token for operational endpoints and rejects non-HTTPS media URLs, credentials embedded in URLs, localhost, metadata hosts, and obvious private-network IP addresses. Signed NotebookLM URLs are temporary access capabilities and must not be logged or shared. The server logs titles and errors but not media bytes.

The relay token must remain private. Anyone who obtains it can submit valid signed media URLs to the configured Telegram or Cloudinary accounts. Rotate `AUTH_SECRET` in Railway and the extension if it is exposed.
