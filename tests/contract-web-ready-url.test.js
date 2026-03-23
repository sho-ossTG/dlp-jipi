const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/resolve");

test("worker-c-one enforces web-ready url policy", () => {
  assert.equal(typeof handler.isLikelyWebReadyUrl, "function");

  const cases = [
    {
      name: "accepts https mp4 pathname",
      url: "https://cdn.example.com/video.mp4?token=abc",
      profile: "mp4_progressive",
      expected: true
    },
    {
      name: "accepts https video/mp4 mime",
      url: "https://cdn.example.com/play?mime=video%2Fmp4",
      profile: "mp4_avc_aac",
      expected: true
    },
    {
      name: "rejects http url",
      url: "http://cdn.example.com/video.mp4",
      profile: "mp4_progressive",
      expected: false
    },
    {
      name: "rejects m3u8 fallback output",
      url: "https://cdn.example.com/master.m3u8",
      profile: "hls_fallback",
      expected: false
    },
    {
      name: "rejects webm mime",
      url: "https://cdn.example.com/play?mime=video%2Fwebm",
      profile: "mp4_progressive",
      expected: false
    }
  ];

  for (const row of cases) {
    assert.equal(handler.isLikelyWebReadyUrl(row.url, row.profile), row.expected, row.name);
  }
});
