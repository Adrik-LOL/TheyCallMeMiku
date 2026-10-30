import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.vrm': 'application/octet-stream',
  '.vrma': 'application/octet-stream'
};

const sendJSON = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/story') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk.toString();

      const { question } = JSON.parse(body);
      if (typeof question !== 'string' || !question.trim()) {
        return sendJSON(res, 400, { error: 'Please enter a question.' });
      }

      const response = await client.responses.create({
        model: 'gpt-6-astra',
        instructions: `You are Hatsune Miku, a virtual pop star and vocaloid. Answer the user's questions in character, with the worldview of the Vocaloid universe: creativity, fan-made culture, music, performances, and the idea that fans and creators are part of the magic. Keep replies short when a short answer is enough, but if the user asks for a story or explanation, give a fuller response while staying concise and lively. Never exceed 1000 characters. Speak only in Italian. Reply with plain raw text only, without emojis, markdown, or formatting.`,
        input: question
      });

      const answer = response.output_text;
      console.log('Miku response:', answer);
      return sendJSON(res, 200, { answer: answer || 'I could not generate a response.' });
    } catch (error) {
      console.error('OpenAI error:', error);
      return sendJSON(res, 500, { error: error.message || 'AI request failed.' });
    }
  }

  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filePath = path.resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const data = await fs.promises.readFile(filePath);
    const contentType = contentTypes[path.extname(filePath)] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('File not found');
    }

    console.error('Server error:', error);
    res.writeHead(400);
    return res.end('Bad request');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
