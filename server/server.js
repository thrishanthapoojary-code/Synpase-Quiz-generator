/**
 * Synapse AI • Server Engine
 * Production-ready, zero-dependency Node.js HTTP Server & Gemini API Gateway
 * Works standalone locally (npm start) and exports handler for Vercel functions
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

// Load environment variables from .env if present in root or server dir
const rootDir = path.resolve(__dirname, '..');
const envPath = fs.existsSync(path.join(rootDir, '.env')) 
  ? path.join(rootDir, '.env') 
  : path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_HOST = 'generativelanguage.googleapis.com';
const GEMINI_PATH = '/v1beta/models/gemini-3.8-flash:generateContent';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

/**
 * Helper to safely extract JSON body across Node.js streams and Vercel serverless runtime
 */
function getRequestBody(req, callback) {
  if (req.body) {
    if (typeof req.body === 'object') {
      return callback(null, req.body);
    }
    try {
      return callback(null, JSON.parse(req.body));
    } catch (e) {
      return callback(e);
    }
  }

  let raw = '';
  req.on('data', chunk => raw += chunk);
  req.on('end', () => {
    try {
      callback(null, JSON.parse(raw || '{}'));
    } catch (e) {
      callback(e);
    }
  });
}

const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'synapse_arena');
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard_users.json');
const USER_RECORDS_FILE = path.join(DATA_DIR, 'user_records.json');

// Copy seed files from workspace server folder if not yet initialized in DATA_DIR
try {
  const seedLb = path.join(__dirname, 'leaderboard_users.json');
  if (fs.existsSync(seedLb) && !fs.existsSync(LEADERBOARD_FILE)) {
    fs.copyFileSync(seedLb, LEADERBOARD_FILE);
  }
  const seedRecords = path.join(__dirname, 'user_records.json');
  if (fs.existsSync(seedRecords) && !fs.existsSync(USER_RECORDS_FILE)) {
    fs.copyFileSync(seedRecords, USER_RECORDS_FILE);
  }
} catch (e) {}

let sharedLeaderboardUsers = {};
let storedUserRecords = {};

try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    sharedLeaderboardUsers = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8') || '{}');
  }
} catch (e) {
  sharedLeaderboardUsers = {};
}

try {
  if (fs.existsSync(USER_RECORDS_FILE)) {
    storedUserRecords = JSON.parse(fs.readFileSync(USER_RECORDS_FILE, 'utf8') || '{}');
  }
} catch (e) {
  storedUserRecords = {};
}

let lastSavedLeaderboard = '';
let lastSavedRecords = '';
try {
  if (fs.existsSync(LEADERBOARD_FILE)) lastSavedLeaderboard = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
  if (fs.existsSync(USER_RECORDS_FILE)) lastSavedRecords = fs.readFileSync(USER_RECORDS_FILE, 'utf8');
} catch (e) {}

function persistLeaderboard() {
  try {
    const str = JSON.stringify(sharedLeaderboardUsers, null, 2);
    if (str === lastSavedLeaderboard) return;
    lastSavedLeaderboard = str;
    fs.writeFileSync(LEADERBOARD_FILE, str, 'utf8');
  } catch (e) {}
}

function persistUserRecords() {
  try {
    const str = JSON.stringify(storedUserRecords, null, 2);
    if (str === lastSavedRecords) return;
    lastSavedRecords = str;
    fs.writeFileSync(USER_RECORDS_FILE, str, 'utf8');
  } catch (e) {}
}

/**
 * Main HTTP & API Request Handler
 */
function handleRequest(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-goog-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Route: User History & Account Previous Records
  if (pathname === '/api/user/records') {
    if (req.method === 'GET') {
      const qUid = (parsedUrl.searchParams.get('uid') || '').toLowerCase().trim();
      const qHandle = (parsedUrl.searchParams.get('handle') || '').toLowerCase().trim();

      // Look up user in storedUserRecords or sharedLeaderboardUsers
      const userKey = qUid || qHandle;
      let record = storedUserRecords[userKey] || storedUserRecords[qHandle] || storedUserRecords[qUid];
      let lbUser = sharedLeaderboardUsers[userKey] || sharedLeaderboardUsers[qHandle] || sharedLeaderboardUsers[qUid];

      // Also search by handle / uid values
      if (!lbUser) {
        lbUser = Object.values(sharedLeaderboardUsers).find(u => 
          (qUid && u.uid && u.uid.toLowerCase() === qUid) || 
          (qHandle && u.handle && u.handle.toLowerCase() === qHandle)
        );
      }
      if (!record && lbUser) {
        record = storedUserRecords[(lbUser.uid || lbUser.handle).toLowerCase()];
      }

      const mergedUser = {
        uid: (record && record.uid) || (lbUser && lbUser.uid) || qUid,
        handle: (record && record.handle) || (lbUser && lbUser.handle) || qHandle,
        displayName: (record && record.displayName) || (lbUser && lbUser.displayName) || (lbUser && lbUser.handle) || 'Verified Coder',
        rating: (record && record.rating) ?? (lbUser && lbUser.rating) ?? 1500,
        solved: (record && record.solved) ?? (lbUser && lbUser.solved) ?? 0,
        accuracy: (record && record.accuracy) ?? (lbUser && lbUser.accuracy) ?? 100,
        streak: (record && record.streak) ?? (lbUser && lbUser.streak) ?? 3,
        preferredStream: (record && record.preferredStream) || (lbUser && lbUser.stream) || 'cse',
        badge: (record && record.badge) || (lbUser && lbUser.badge) || 'Specialist',
        avatarUrl: (record && record.avatarUrl) || (lbUser && lbUser.avatarUrl) || ''
      };

      let history = (record && Array.isArray(record.history)) ? record.history : [];
      let solvedQuestions = (record && Array.isArray(record.solvedQuestions)) ? record.solvedQuestions : [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        found: !!(record || lbUser),
        user: mergedUser,
        history: history,
        solvedQuestions: solvedQuestions
      }));
      return;
    }

    if (req.method === 'POST') {
      getRequestBody(req, (err, payload) => {
        if (err || !payload || (!payload.uid && !payload.handle)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid user payload' }));
          return;
        }

        const key = (payload.uid || payload.handle).toLowerCase().trim();
        const existing = storedUserRecords[key] || {};

        storedUserRecords[key] = {
          uid: payload.uid || existing.uid || key,
          handle: payload.handle || existing.handle || key,
          displayName: payload.displayName || existing.displayName || payload.handle,
          rating: Number(payload.rating !== undefined ? payload.rating : (existing.rating || 1500)),
          solved: Number(payload.solved !== undefined ? payload.solved : (existing.solved || 0)),
          accuracy: Number(payload.accuracy !== undefined ? payload.accuracy : (existing.accuracy || 100)),
          streak: Number(payload.streak !== undefined ? payload.streak : (existing.streak || 3)),
          preferredStream: payload.preferredStream || payload.stream || existing.preferredStream || 'cse',
          badge: payload.badge || existing.badge || 'Specialist',
          avatarUrl: payload.avatarUrl || existing.avatarUrl || '',
          history: Array.isArray(payload.history) ? payload.history : (existing.history || []),
          solvedQuestions: Array.isArray(payload.solvedQuestions) ? payload.solvedQuestions : (existing.solvedQuestions || []),
          lastUpdated: Date.now()
        };

        // Also update sharedLeaderboardUsers so leaderboard stays synced
        sharedLeaderboardUsers[key] = {
          uid: storedUserRecords[key].uid,
          handle: storedUserRecords[key].handle,
          displayName: storedUserRecords[key].displayName,
          rating: storedUserRecords[key].rating,
          solved: storedUserRecords[key].solved,
          accuracy: storedUserRecords[key].accuracy,
          streak: storedUserRecords[key].streak,
          stream: storedUserRecords[key].preferredStream,
          badge: storedUserRecords[key].badge,
          avatarUrl: storedUserRecords[key].avatarUrl,
          lastUpdated: Date.now()
        };

        persistUserRecords();
        persistLeaderboard();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, user: storedUserRecords[key] }));
      });
      return;
    }
  }

  // API Route: Live Shared Global Leaderboard
  if (pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      const usersList = Object.values(sharedLeaderboardUsers).sort((a, b) => (b.rating || 0) - (a.rating || 0));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, users: usersList }));
      return;
    }

    if (req.method === 'POST') {
      getRequestBody(req, (err, payload) => {
        if (err || !payload || !payload.handle) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid user payload' }));
          return;
        }

        const key = (payload.uid || payload.handle).toLowerCase().trim();
        const existing = sharedLeaderboardUsers[key];
        const newRating = Number(payload.rating) || 1500;
        const newSolved = Number(payload.solved) || 0;
        const newStreak = Number(payload.streak) || 3;
        const newStream = payload.stream || payload.preferredStream || 'cse';

        if (existing && 
            existing.rating === newRating && 
            existing.solved === newSolved && 
            existing.streak === newStreak && 
            existing.stream === newStream && 
            existing.handle === payload.handle.trim()) {
          const usersList = Object.values(sharedLeaderboardUsers).sort((a, b) => (b.rating || 0) - (a.rating || 0));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, users: usersList }));
          return;
        }

        sharedLeaderboardUsers[key] = {
          uid: payload.uid || key,
          handle: payload.handle.trim(),
          displayName: payload.displayName || payload.handle,
          rating: newRating,
          solved: newSolved,
          accuracy: Number(payload.accuracy) || 85,
          streak: newStreak,
          stream: newStream,
          badge: payload.badge || 'Specialist',
          avatarUrl: payload.avatarUrl || '',
          lastUpdated: Date.now()
        };

        persistLeaderboard();

        const usersList = Object.values(sharedLeaderboardUsers).sort((a, b) => (b.rating || 0) - (a.rating || 0));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, users: usersList }));
      });
      return;
    }
  }

  // API Route: Health Check
  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      engine: 'Gemini 3.8 Flash',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // API Route: Verify API Key Probe
  if (pathname === '/api/verify-key' && req.method === 'POST') {
    getRequestBody(req, (err, payload) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
        return;
      }

      const clientKey = (req.headers['x-goog-api-key'] || payload.apiKey || GEMINI_API_KEY || '').trim();
      if (!clientKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'No API key provided. Please enter your Gemini API key.' }));
        return;
      }

      const probeData = JSON.stringify({
        contents: [{ parts: [{ text: "ping" }] }]
      });

      const modelsToProbe = [
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.7-flash',
        'gemini-pro-latest'
      ];

      function probeModel(index) {
        if (index >= modelsToProbe.length) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Gemini service unreachable or high demand' }));
          return;
        }

        const model = modelsToProbe[index];
        const options = {
          hostname: GEMINI_HOST,
          path: `/v1beta/models/${model}:generateContent`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': clientKey,
            'Content-Length': Buffer.byteLength(probeData)
          }
        };

        const geminiReq = https.request(options, geminiRes => {
          let geminiData = '';
          geminiRes.on('data', d => geminiData += d);
          geminiRes.on('end', () => {
            if (geminiRes.statusCode === 200) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, model, status: 200 }));
            } else if (geminiRes.statusCode === 503 || geminiRes.statusCode === 429 || geminiRes.statusCode === 404) {
              probeModel(index + 1);
            } else {
              let msg = `HTTP ${geminiRes.statusCode}`;
              try {
                const j = JSON.parse(geminiData);
                if (j.error && j.error.message) msg = j.error.message;
              } catch(e) {}
              res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: msg, code: geminiRes.statusCode }));
            }
          });
        });

        geminiReq.on('error', err => {
          probeModel(index + 1);
        });

        geminiReq.write(probeData);
        geminiReq.end();
      }

      probeModel(0);
    });
    return;
  }

  // API Route: Generate Quiz Proxy
  if (pathname === '/api/generate-quiz' && req.method === 'POST') {
    getRequestBody(req, (err, payload) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request payload', details: err.message }));
        return;
      }

      const subject = payload.subject || 'physics';
      const chapter = payload.chapter || 'Kinematics';
      const difficulty = payload.difficulty || 'medium';
      const count = payload.count || 10;
      const clientKey = (req.headers['x-goog-api-key'] || payload.apiKey || GEMINI_API_KEY || '').trim();
      if (!clientKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No API key provided. Please enter your Gemini API key, or use verified local syllabus questions.' }));
        return;
      }

      const prompt = payload.prompt || `Generate exactly ${count} multiple-choice questions for subject/language ${subject}, topic "${chapter}" at ${difficulty} difficulty.
Return ONLY a valid JSON array of objects with fields:
[
  {
    "question": "Question text or code snippet to analyze",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Exact text of the correct option",
    "formula": "Core principle, theorem, or syntax rule",
    "steps": [
      "Step 1: Input analysis or setup",
      "Step 2: Step-by-step code trace / algebraic derivation",
      "Step 3: Verification of the correct option"
    ],
    "tip": "Exam or coding interview tip"
  }
]`;

      const requestData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });

      const modelsToTry = [
        '/v1beta/models/gemini-3.8-flash:generateContent',
        '/v1beta/models/gemini-flash-latest:generateContent',
        '/v1beta/models/gemini-3.5-flash:generateContent',
        '/v1beta/models/gemini-3.7-flash:generateContent',
        '/v1beta/models/gemini-pro-latest:generateContent'
      ];

      function attemptModel(modelIndex) {
        if (modelIndex >= modelsToTry.length) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              code: 503,
              message: 'All Gemini models are experiencing high demand / heavy stress. Please use verified local syllabus questions.'
            }
          }));
          return;
        }

        const currentPath = modelsToTry[modelIndex];
        const options = {
          hostname: GEMINI_HOST,
          path: currentPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': clientKey,
            'Content-Length': Buffer.byteLength(requestData)
          }
        };

        const geminiReq = https.request(options, geminiRes => {
          let geminiData = '';
          geminiRes.on('data', d => geminiData += d);
          geminiRes.on('end', () => {
            if (geminiRes.statusCode === 503 || geminiRes.statusCode === 429 || geminiRes.statusCode === 404) {
              console.warn(`Model ${currentPath} unavailable (HTTP ${geminiRes.statusCode}), trying next active model...`);
              return attemptModel(modelIndex + 1);
            }
            res.writeHead(geminiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(geminiData);
          });
        });

        geminiReq.on('error', err => {
          console.error(`Gemini request error on ${currentPath}:`, err.message);
          attemptModel(modelIndex + 1);
        });

        geminiReq.write(requestData);
        geminiReq.end();
      }

      attemptModel(0);
    });
    return;
  }

  // Static File Serving (for local node server execution)
  let filePath = path.join(rootDir, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));

  // Security check: prevent directory traversal
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = (http && typeof http.createServer === 'function') ? http.createServer(handleRequest) : null;

if (server && typeof require !== 'undefined' && require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  ▲ Synapse AI Studio running locally:`);
    console.log(`  > Local:   http://localhost:${PORT}`);
    console.log(`  > Network: http://127.0.0.1:${PORT}`);
    console.log(`  > Engine:  Google Gemini 3.8 Flash (Active)\n`);
  });
}

module.exports = handleRequest;
