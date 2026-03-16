# Say Cheese — Photo Caption Contest

A full-stack web app where users create accounts, write captions for photos, like their favourites, and compete on a live leaderboard.

---

## Features

- **Authentication** — Register and login with hashed passwords. Sessions are managed with secure random tokens that expire after 7 days
- **Photo Grid** — Browse a curated set of contest photos with smooth hover effects
- **Caption Contest** — Write captions for any photo and post them instantly
- **Likes** — Like other users' captions to push them up the leaderboard
- **Photo Uploads** — Upload your own photos to add to the contest (jpg, jpeg, png, gif, webp — max 5MB)
- **Leaderboard** — Dedicated page showing the top-liked captions and the most-captioned photos
- **Responsive** — Works on desktop and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite (via `sqlite3`) |
| Auth | bcrypt password hashing + crypto session tokens |
| File Uploads | Multer |

---

## Project Structure

```
say-cheese/
├── Photos/               # Contest photos + user uploads
│   ├── charli_1.jpeg
│   ├── charli_2.jpeg
│   ├── charli_3.jpeg
│   ├── thevamps_1.jpeg
│   ├── thevamps_2.jpeg
│   ├── thevamps_3.jpeg
│   ├── tyga_1.jpeg
│   ├── tyga_2.jpeg
│   ├── tyga_3.jpeg
│   └── Photo_Camera.jpeg  # Logo/branding image
├── index.html             # Main contest page
├── login.html             # Login & register page
├── leaderboard.html       # Leaderboard page
├── style.css              # All styles (shared across all pages)
├── server.js              # Express server + all API routes
├── saycheese.db           # SQLite database (auto-created on first run)
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/say-cheese.git
cd say-cheese

# 2. Install dependencies
npm install

# 3. Start the server
node server.js
```

Then open your browser and go to:
```
http://localhost:3000/login.html
```

The database and all tables are created automatically on first run. The 9 default contest photos are also seeded automatically.

---

## API Endpoints

All endpoints except `/login` and `/register` require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create a new account. Returns `userId` and `token` |
| POST | `/login` | Login to existing account. Returns `userId` and `token` |
| POST | `/logout` | Invalidates the current session token |

### Photos

| Method | Endpoint | Description |
|---|---|---|
| GET | `/photos` | Get all contest photos |
| POST | `/upload-photo` | Upload a new photo (multipart/form-data, field name: `photo`) |

### Captions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/captions` | Post a caption. Body: `{ photo_id, caption_text }` |
| GET | `/all-captions` | Get all captions with username and photo info, sorted by likes |
| POST | `/like-caption/:id` | Increment likes on a caption by 1 |

---

## Database Schema

```sql
users (
    id            INTEGER PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
)

sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER,
    created_at INTEGER        -- Unix timestamp, expires after 7 days
)

photos (
    id          INTEGER PRIMARY KEY,
    url         TEXT NOT NULL,
    uploaded_by INTEGER,       -- NULL for default/seeded photos
    created_at  INTEGER
)

captions (
    id           INTEGER PRIMARY KEY,
    photo_id     INTEGER NOT NULL,
    caption_text TEXT NOT NULL,
    user_id      INTEGER NOT NULL,
    likes        INTEGER DEFAULT 0,
    created_at   INTEGER
)
```

---

## Deploying to Railway

[Railway](https://railway.app) is the recommended platform for deploying this app as it supports persistent storage on the free tier, meaning your SQLite database and uploaded photos survive restarts.

1. Push your project to GitHub
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click **New Project → Deploy from GitHub repo** and select your repo
4. Add an environment variable: `PORT=3000`
5. Railway will automatically detect Node.js and deploy

Your app will be live at a Railway-provided URL that you can share with friends.

> **Note:** Make sure `saycheese.db` is in your `.gitignore` so you don't commit local test data. Railway will create a fresh database on first deploy.

---

##  .gitignore

Create a `.gitignore` file in your project root with the following:

```
node_modules/
saycheese.db
.env
```

---

## Dependencies

```json
{
  "express": "^4.x",
  "sqlite3": "^5.x",
  "bcrypt": "^5.x",
  "multer": "^1.x"
}
```

Install all with:
```bash
npm install express sqlite3 bcrypt multer
```

---
## 🙌 Author
