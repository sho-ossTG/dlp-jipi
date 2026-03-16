const test = require("node:test");
const assert = require("node:assert/strict");

function loadFreshHandler() {
  delete require.cache[require.resolve("./resolve.js")];
  return require("./resolve.js");
}

async function invoke(handler, { method = "GET", url = "/api/resolve", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const responseHeaders = {};
    let body = "";

    const req = {
      method,
      url,
      headers: {
        host: "localhost",
        ...headers,
      },
    };

    const res = {
      statusCode: 200,
      setHeader(name, value) {
        responseHeaders[String(name).toLowerCase()] = value;
      },
      end(chunk = "") {
        body += String(chunk);
        resolve({
          statusCode: this.statusCode,
          headers: responseHeaders,
          body,
        });
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

test("non-GET /api/resolve returns 405 with strict error envelope", async () => {
  const handler = loadFreshHandler();
  const response = await invoke(handler, { method: "POST", url: "/api/resolve" });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "GET");
  assert.equal(response.headers["content-type"], "application/json");
  assert.deepEqual(Object.keys(payload), ["error", "detail"]);
  assert.deepEqual(payload, {
    error: "method_not_allowed",
    detail: "Only GET is allowed for /api/resolve.",
  });
});

test("GET /api/resolve without url returns 400 with strict error envelope", async () => {
  const handler = loadFreshHandler();
  const response = await invoke(handler, { method: "GET", url: "/api/resolve" });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers["content-type"], "application/json");
  assert.deepEqual(Object.keys(payload), ["error", "detail"]);
  assert.deepEqual(payload, {
    error: "missing_url_parameter",
    detail: "The url query parameter is required.",
  });
});

test("GET /api/resolve with invalid url returns 400 with strict error envelope", async () => {
  const handler = loadFreshHandler();
  const response = await invoke(handler, { method: "GET", url: "/api/resolve?url=notaurl" });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers["content-type"], "application/json");
  assert.deepEqual(Object.keys(payload), ["error", "detail"]);
  assert.deepEqual(payload, {
    error: "invalid_url",
    detail: "The url query parameter must be a valid http(s) URL.",
  });
});
