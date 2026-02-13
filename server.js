import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const CUSTOM_WORDS_PATH = path.join(__dirname, 'custom-words.json');
const BASE_WORDS_PATH = path.join(__dirname, 'dist', 'words.json');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

function getCustomWords() {
  try {
    const data = fs.readFileSync(CUSTOM_WORDS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function saveCustomWords(arr) {
  fs.writeFileSync(CUSTOM_WORDS_PATH, JSON.stringify(arr, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0].split('#')[0];

  if (pathname === '/api/words') {
    if (req.method === 'GET') {
      fs.readFile(BASE_WORDS_PATH, (err, data) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500);
          res.end(JSON.stringify({ error: err.code === 'ENOENT' ? 'Word list not found' : 'Error' }));
          return;
        }
        try {
          const base = JSON.parse(data.toString());
          const custom = getCustomWords();
          const merged = [...new Set([...base, ...custom])];
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(merged));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Invalid word list' }));
        }
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const parsed = JSON.parse(body);
          const word = parsed && typeof parsed.word === 'string' ? parsed.word.trim().toLowerCase() : '';
          if (word.length !== 5 || !/^[a-z]+$/.test(word)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Word must be 5 letters' }));
            return;
          }
          const custom = getCustomWords();
          if (custom.includes(word)) {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, alreadyAdded: true }));
            return;
          }
          custom.push(word);
          saveCustomWords(custom);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
      return;
    }
  }

  const file = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, file.replace(/^\//, ''));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Error');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Wordle solver UI: http://localhost:' + PORT);
});
