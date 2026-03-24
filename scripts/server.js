const http = require('http')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const ROOT = path.join(__dirname, '..')
const PORT = Number.parseInt(process.env.PORT, 10) || 8080

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

function safeFilePath(requestPath) {
  const pathname = decodeURIComponent(requestPath.split('?')[0])
  let rel = pathname === '/' || pathname === '' ? 'index.html' : pathname.replace(/^\/+/, '')
  if (rel.endsWith('/')) {
    rel += 'index.html'
  }
  const full = path.resolve(ROOT, rel)
  const relativeToRoot = path.relative(ROOT, full)
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null
  }
  return full
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json; charset=utf-8' }
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}')
  } catch {
    return null
  }
}

function getOpenAiKey(res) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    res.writeHead(503, jsonHeaders())
    res.end(JSON.stringify({
      error: 'Server missing OPENAI_API_KEY. Set it in .env and restart the dev server.'
    }))
    return null
  }
  return key
}

async function handleRewrite(req, res) {
  const body = await readJsonBody(req)
  if (body === null) {
    res.writeHead(400, jsonHeaders())
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }
  const text = (body.text || '').trim()
  if (!text) {
    res.writeHead(400, jsonHeaders())
    res.end(JSON.stringify({ error: 'No text to rewrite' }))
    return
  }
  const key = getOpenAiKey(res)
  if (!key) {
    return
  }
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an editor for short travel diary entries. Polish the user text: fix grammar and spelling, improve clarity and flow, keep the same meaning, facts, and tone. Do not invent new places or events. Reply with only the polished text, no quotation marks or preamble.'
          },
          { role: 'user', content: text }
        ]
      })
    })
    const data = await openaiRes.json()
    if (!openaiRes.ok) {
      res.writeHead(502, jsonHeaders())
      res.end(JSON.stringify({ error: data.error?.message || 'OpenAI request failed' }))
      return
    }
    const polished = (data.choices?.[0]?.message?.content || '').trim()
    res.writeHead(200, jsonHeaders())
    res.end(JSON.stringify({ polished }))
  } catch (e) {
    res.writeHead(500, jsonHeaders())
    res.end(JSON.stringify({ error: e.message || 'Server error' }))
  }
}

async function handleRecommend(req, res) {
  const body = await readJsonBody(req)
  if (body === null) {
    res.writeHead(400, jsonHeaders())
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }
  const places = Array.isArray(body.places) ? body.places : []
  if (places.length === 0) {
    res.writeHead(400, jsonHeaders())
    res.end(JSON.stringify({ error: 'Add at least one travel story so we can suggest a next place.' }))
    return
  }
  const key = getOpenAiKey(res)
  if (!key) {
    return
  }
  const userPayload = JSON.stringify({ visited_places: places })
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a travel advisor. Given places the user has already visited (each with coordinate "lat,lng", optional titles and short notes), recommend exactly ONE next destination they would likely enjoy. Pick a real city or well-known region they have not already visited (avoid repeating the same city or very nearby duplicate). Reply with a JSON object only, with keys: "name" (string, destination name), "latitude" (number, decimal degrees), "longitude" (number, decimal degrees), "reason" (string, 1-3 sentences explaining why it fits their travel history). Use valid WGS84 coordinates.'
          },
          {
            role: 'user',
            content: `Here is their travel history as JSON. Recommend the next place.\n${userPayload}`
          }
        ]
      })
    })
    const data = await openaiRes.json()
    if (!openaiRes.ok) {
      res.writeHead(502, jsonHeaders())
      res.end(JSON.stringify({ error: data.error?.message || 'OpenAI request failed' }))
      return
    }
    const raw = (data.choices?.[0]?.message?.content || '').trim()
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      res.writeHead(502, jsonHeaders())
      res.end(JSON.stringify({ error: 'Could not parse recommendation' }))
      return
    }
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
    const latitude = Number(parsed.latitude)
    const longitude = Number(parsed.longitude)
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : ''
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.writeHead(502, jsonHeaders())
      res.end(JSON.stringify({ error: 'Invalid recommendation from model' }))
      return
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      res.writeHead(502, jsonHeaders())
      res.end(JSON.stringify({ error: 'Coordinates out of range' }))
      return
    }
    res.writeHead(200, jsonHeaders())
    res.end(JSON.stringify({ name, latitude, longitude, reason }))
  } catch (e) {
    res.writeHead(500, jsonHeaders())
    res.end(JSON.stringify({ error: e.message || 'Server error' }))
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api/rewrite')) {
    handleRewrite(req, res)
    return
  }
  if (req.method === 'POST' && req.url.startsWith('/api/recommend')) {
    handleRecommend(req, res)
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  const filePath = safeFilePath(req.url)
  if (!filePath) {
    res.writeHead(403).end()
    return
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404).end('Not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const type = MIME[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(filePath).pipe(res)
  })
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`http://localhost:${PORT}`)
  if (!process.env.OPENAI_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('OPENAI_API_KEY is not set; Rewrite and Recommend will fail until you set it.')
  }
})
