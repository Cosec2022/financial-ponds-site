import worker from "../dist/server/index.js";

const port = Number(process.env.PORT || 4174);
const http = await import("node:http");
http.createServer(async (req, res) => {
  const url = `http://localhost:${port}${req.url}`;
  const request = new Request(url, { method: req.method, headers: req.headers });
  const response = await worker.fetch(request, {});
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`Financial Ponds preview: http://localhost:${port}`);
});
