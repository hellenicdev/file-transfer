# File Transfer

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S6S31XB030)

Temporary, real-time file-sharing rooms. Create a room, share its 6-character code, and everyone in the room can upload and download files instantly — no account required.

**Live:** https://hellenicdev.eu/file-transfer/

## Features

- Create or join a room with a short code (Cloudflare Turnstile protected)
- Drag-and-drop multi-file uploads (up to 10 files per upload) with progress bars
- Real-time file list updates for everyone in the room via Socket.IO
- Uploaders can delete their own files
- Rooms expire automatically after a period of inactivity (default 24 hours)
- Files stored in MongoDB GridFS
- Rate limiting on room creation, joining and uploads; risky executable types blocked

## Tech stack

- **Frontend:** vanilla HTML, CSS and JavaScript (GitHub Pages)
- **Backend:** Node.js, Express, Socket.IO, Multer
- **Database:** MongoDB (Mongoose + GridFS)
- **Hosting:** Render (API), GitHub Pages (frontend)

## Setup

```bash
git clone https://github.com/hellenicdev/file-transfer.git
cd file-transfer/backend
cp .env.example .env   # then fill in the values
npm install
npm start
```

Serve the repository root (e.g. `npx serve .`) for the frontend and point `API_URL` in `config.js` at your backend.

### Environment variables (backend)

| Name | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (required) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key |
| `FRONTEND_URL` | Allowed CORS origin (defaults to `https://hellenicdev.eu`) |
| `MAX_FILE_SIZE` | Max upload size in bytes (default 100 MB) |
| `ROOM_TTL_SECONDS` | Idle time before a room expires (default 86400) |
| `PORT` | HTTP port (default 10000) |

## Project structure

```
├── index.html, app.js      # Landing page: create / join a room
├── room.html, room.js      # Room page: upload, list, download files
├── config.js               # Frontend API URL and Turnstile site key
├── style.css
└── backend/
    ├── server.js           # Express + Socket.IO entry point
    ├── routes/             # rooms.js, files.js
    ├── models/             # Room, File (Mongoose)
    ├── middleware/         # rate limiting, uploads, Turnstile
    ├── gridfs/             # GridFS helpers
    └── sockets/            # real-time room events
```

## License

BSD 3-Clause — see [LICENSE](LICENSE).

---

Made by [HellenicDev](https://hellenicdev.eu).
