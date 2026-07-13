const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'public');
const types = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.xml':'application/xml', '.txt':'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let full = path.join(root, p);
  if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, '404.html'), (e2, data2) => {
        res.writeHead(404, {'Content-Type':'text/html'});
        res.end(data2 || 'Not found');
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, () => console.log('serving on 8080'));
