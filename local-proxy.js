const http = require("node:http");
const { URL } = require("node:url");

const PORT = 8787;
const OPEN_DART_ORIGIN = "https://opendart.fss.or.kr";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const target = new URL(requestUrl.searchParams.get("url") || "");

    if (target.origin !== OPEN_DART_ORIGIN) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Only OpenDART API requests are allowed." }));
      return;
    }

    const upstream = await fetch(target);
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const body = Buffer.from(await upstream.arrayBuffer());

    res.writeHead(upstream.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "OpenDART proxy request failed." }));
  }
});

server.listen(PORT, () => {
  console.log(`OpenDART local proxy: http://localhost:${PORT}`);
});
