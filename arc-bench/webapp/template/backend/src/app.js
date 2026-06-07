const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const distDir = path.resolve(__dirname, '../dist');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(distDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    return next();
  }
  return res.sendFile(path.join(distDir, 'index.html'));
});

module.exports = app;
