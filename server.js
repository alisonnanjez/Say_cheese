const express    = require('express');
const sqlite3    = require('sqlite3').verbose();
const bcrypt     = require('bcrypt');
const multer     = require('multer');
const path       = require('path');
const crypto     = require('crypto');
const fs         = require('fs');
const app        = express();
const port       = process.env.PORT || 3000;
const saltRounds = 10;

// ─── ENSURE UPLOAD FOLDER EXISTS ────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'Photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static('.'));

// ─── DATABASE SETUP ──────────────────────────────────────────────────────────
const db = new sqlite3.Database('./saycheese.db');

db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS photos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        url         TEXT NOT NULL,
        uploaded_by INTEGER,
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        FOREIGN KEY(uploaded_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS captions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id     INTEGER NOT NULL,
        caption_text TEXT NOT NULL,
        user_id      INTEGER NOT NULL,
        likes        INTEGER DEFAULT 0,
        created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        FOREIGN KEY(photo_id) REFERENCES photos(id),
        FOREIGN KEY(user_id)  REFERENCES users(id)
    )`);

    // Seed the default photos if the table is empty
    db.get(`SELECT COUNT(*) as count FROM photos`, [], (err, row) => {
        if (err || row.count > 0) return;

        const defaults = [
            'Photos/charli_1.jpeg',  'Photos/charli_2.jpeg',  'Photos/charli_3.jpeg',
            'Photos/thevamps_1.jpeg','Photos/thevamps_2.jpeg','Photos/thevamps_3.jpeg',
            'Photos/tyga_1.jpeg',    'Photos/tyga_2.jpeg',    'Photos/tyga_3.jpeg'
        ];

        const stmt = db.prepare(`INSERT INTO photos (url, uploaded_by) VALUES (?, NULL)`);
        defaults.forEach(url => stmt.run(url));
        stmt.finalize();
        console.log('✅ Default photos seeded');
    });
});

// ─── MULTER — FILE UPLOAD CONFIG ─────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const ext      = path.extname(file.originalname).toLowerCase();
        const safeName = `user_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext     = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'));
        }
    }
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
// Attaches req.user if a valid session token is present in the Authorization header.
// Protected routes call requireAuth to reject unauthenticated requests.

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const now = Math.floor(Date.now() / 1000);

    db.get(
        `SELECT sessions.user_id, users.username
         FROM sessions
         JOIN users ON sessions.user_id = users.id
         WHERE sessions.token = ? AND sessions.created_at > ?`,
        [token, now - SESSION_TTL],
        (err, row) => {
            if (err || !row) {
                return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
            }
            req.user = { id: row.user_id, username: row.username };
            next();
        }
    );
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// Register
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        db.run(
            `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
            [username.trim(), hash],
            function(err) {
                if (err) return res.status(400).json({ message: 'Username already taken' });

                const token = crypto.randomBytes(32).toString('hex');
                const now   = Math.floor(Date.now() / 1000);

                db.run(
                    `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
                    [token, this.lastID, now],
                    () => res.json({ message: 'Account created', userId: this.lastID, token })
                );
            }
        );
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username.trim()], async (err, user) => {
        if (err || !user) return res.status(400).json({ message: 'User not found' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(400).json({ message: 'Invalid password' });

        const token = crypto.randomBytes(32).toString('hex');
        const now   = Math.floor(Date.now() / 1000);

        db.run(
            `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
            [token, user.id, now],
            () => res.json({ message: 'Welcome back', userId: user.id, token })
        );
    });
});

// Logout — invalidates the token
app.post('/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization'].slice(7);
    db.run(`DELETE FROM sessions WHERE token = ?`, [token], () => {
        res.json({ message: 'Logged out' });
    });
});

// ─── PHOTO ROUTES ─────────────────────────────────────────────────────────────

// Get all photos (protected)
app.get('/photos', requireAuth, (req, res) => {
    db.all(
        `SELECT photos.id, photos.url, users.username as uploaded_by
         FROM photos
         LEFT JOIN users ON photos.uploaded_by = users.id
         ORDER BY photos.created_at ASC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Error fetching photos' });
            res.json(rows);
        }
    );
});

// Upload a new photo (protected)
app.post('/upload-photo', requireAuth, (req, res) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || 'Upload failed' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file received. Make sure you selected an image.' });
        }

        const url = `Photos/${req.file.filename}`;

        db.run(
            `INSERT INTO photos (url, uploaded_by) VALUES (?, ?)`,
            [url, req.user.id],
            function(dbErr) {
                if (dbErr) return res.status(500).json({ message: 'Could not save photo to database' });
                res.json({ message: 'Photo uploaded!', photo: { id: this.lastID, url } });
            }
        );
    });
});

// ─── CAPTION ROUTES ───────────────────────────────────────────────────────────

// Post a caption (protected) — uses photo_id to look up the real URL
app.post('/captions', requireAuth, (req, res) => {
    const { photo_id, caption_text } = req.body;

    if (!photo_id || !caption_text || !caption_text.trim()) {
        return res.status(400).json({ message: 'photo_id and caption_text are required' });
    }

    // Verify the photo exists first
    db.get(`SELECT id FROM photos WHERE id = ?`, [photo_id], (err, photo) => {
        if (err || !photo) return res.status(404).json({ message: 'Photo not found' });

        db.run(
            `INSERT INTO captions (photo_id, caption_text, user_id) VALUES (?, ?, ?)`,
            [photo_id, caption_text.trim(), req.user.id],
            function(err) {
                if (err) return res.status(500).json({ message: 'Database error' });
                res.json({ message: 'Caption posted!', id: this.lastID });
            }
        );
    });
});

// Get all captions with joins (protected)
app.get('/all-captions', requireAuth, (req, res) => {
    const sql = `
        SELECT
            captions.id,
            captions.caption_text,
            captions.likes,
            photos.url   AS photo_url,
            photos.id    AS photo_id,
            users.username
        FROM captions
        JOIN photos ON captions.photo_id = photos.id
        JOIN users  ON captions.user_id  = users.id
        ORDER BY captions.likes DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching captions' });
        res.json(rows);
    });
});

// Like a caption (protected)
app.post('/like-caption/:id', requireAuth, (req, res) => {
    db.run(
        `UPDATE captions SET likes = likes + 1 WHERE id = ?`,
        [req.params.id],
        function(err) {
            if (err || this.changes === 0) {
                return res.status(404).json({ message: 'Caption not found' });
            }
            res.json({ message: 'Liked!' });
        }
    );
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`✅ Say Cheese running at http://localhost:${port}`);
    console.log(`👉 Open http://localhost:${port}/login.html`);
});
