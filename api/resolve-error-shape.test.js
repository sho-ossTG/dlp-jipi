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

function parseLoggedEntry(callArgs) {
  try {
    return JSON.parse(String(callArgs[0] || ""));
  } catch {
    return null;
  }
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

test("method-not-allowed failures log structured machine fields", async () => {
  const handler = loadFreshHandler();
  const originalConsoleError = console.error;
  const errorCalls = [];
  console.error = (...args) => {
    errorCalls.push(args);
  };

  try {
    await invoke(handler, {
      method: "POST",
      url: "/api/resolve",
      headers: {
        "x-correlation-id": "corr-c1-method",
        "x-request-id": "req-c1-method",
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  const methodLog = errorCalls
    .map(parseLoggedEntry)
    .find((entry) => entry && entry.event === "method_not_allowed");

  assert.ok(methodLog, "expected a method_not_allowed log entry");
  assert.equal(methodLog.server, "C");
  assert.equal(methodLog.error, "method_not_allowed");
  assert.equal(methodLog.detail, "Only GET is allowed for /api/resolve; received POST.");
  assert.equal(methodLog.correlationId, "corr-c1-method");
  assert.equal(methodLog.requestId, "req-c1-method");
  assert.equal(methodLog.method, "POST");
  assert.equal(methodLog.path, "/api/resolve");
});

test("missing-url failures log structured machine fields", async () => {
  const handler = loadFreshHandler();
  const originalConsoleError = console.error;
  const errorCalls = [];
  console.error = (...args) => {
    errorCalls.push(args);
  };

  try {
    await invoke(handler, {
      method: "GET",
      url: "/api/resolve",
      headers: {
        "x-correlation-id": "corr-c1-missing",
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  const missingUrlLog = errorCalls
    .map(parseLoggedEntry)
    .find((entry) => entry && entry.event === "missing_url_param");

  assert.ok(missingUrlLog, "expected a missing_url_param log entry");
  assert.equal(missingUrlLog.server, "C");
  assert.equal(missingUrlLog.error, "missing_url_parameter");
  assert.equal(missingUrlLog.detail, "The url query parameter is required.");
  assert.equal(missingUrlLog.correlationId, "corr-c1-missing");
  assert.equal(missingUrlLog.requestId, "corr-c1-missing");
  assert.equal(missingUrlLog.method, "GET");
  assert.equal(missingUrlLog.path, "/api/resolve");
});
