const handleRequest = require('../server/server.js');

module.exports = (req, res) => {
  try {
    handleRequest(req, res);
  } catch (err) {
    console.error('generate-quiz error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }
};
