const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || '/data/cslb-progress';
const indexPath = path.join(__dirname, 'index.html');
const keyPattern = /^CSLB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const maxBodyBytes = 2 * 1024 * 1024;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  res.end(body);
}

function recordPath(key) {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(dataDir, `${digest}.json`);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error('too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleProgress(req, res, key) {
  if (!keyPattern.test(key)) {
    return send(res, 400, JSON.stringify({ error: 'Invalid recovery code.' }));
  }

  const file = recordPath(key);
  if (req.method === 'GET') {
    try {
      return send(res, 200, await fsp.readFile(file, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return send(res, 404, JSON.stringify({ error: 'Backup not found.' }));
      throw error;
    }
  }

  if (req.method === 'PUT') {
    const raw = await readBody(req);
    let payload;
    try { payload = JSON.parse(raw); } catch (_) {
      return send(res, 400, JSON.stringify({ error: 'Invalid backup data.' }));
    }
    if (!payload || typeof payload !== 'object' || !payload.state || typeof payload.state !== 'object') {
      return send(res, 400, JSON.stringify({ error: 'Backup state is required.' }));
    }
    const saved = JSON.stringify({
      version: 1,
      updatedAt: Number(payload.updatedAt) || Date.now(),
      state: payload.state
    });
    await fsp.mkdir(dataDir, { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temp, saved, { encoding: 'utf8', mode: 0o600 });
    await fsp.rename(temp, file);
    return send(res, 200, JSON.stringify({ ok: true, updatedAt: JSON.parse(saved).updatedAt }));
  }

  if (req.method === 'DELETE') {
    try { await fsp.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  send(res, 405, JSON.stringify({ error: 'Method not allowed.' }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/api\/progress\/([^/]+)$/);
    if (match) return await handleProgress(req, res, decodeURIComponent(match[1]).toUpperCase());
    if (url.pathname === '/health') return send(res, 200, JSON.stringify({ ok: true }));
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed.', 'text/plain; charset=utf-8');
    const html = await fsp.readFile(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) send(res, error.status || 500, JSON.stringify({ error: 'Server error.' }));
    else res.end();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`CSLB study app listening on ${port}; progress directory: ${dataDir}`);
});
