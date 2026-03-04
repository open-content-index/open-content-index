import { parseISO8601Duration, parsePlaylistIdFromUrl } from "./fetch-playlist.ts";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("parseISO8601Duration", () => {
  it("parses hours, minutes, and seconds", () => {
    assert.equal(parseISO8601Duration("PT3H3M4S"), 10984);
  });

  it("parses minutes and seconds only", () => {
    assert.equal(parseISO8601Duration("PT1M29S"), 89);
  });

  it("parses hours and minutes only", () => {
    assert.equal(parseISO8601Duration("PT2H30M"), 9000);
  });

  it("parses seconds only", () => {
    assert.equal(parseISO8601Duration("PT45S"), 45);
  });

  it("parses hours only", () => {
    assert.equal(parseISO8601Duration("PT1H"), 3600);
  });

  it("parses minutes only", () => {
    assert.equal(parseISO8601Duration("PT10M"), 600);
  });

  it("parses zero duration", () => {
    assert.equal(parseISO8601Duration("PT0S"), 0);
  });

  it("throws on invalid format", () => {
    assert.throws(() => parseISO8601Duration("invalid"), /Invalid ISO 8601/);
  });

  it("throws on empty string", () => {
    assert.throws(() => parseISO8601Duration(""), /Invalid ISO 8601/);
  });
});

describe("parsePlaylistIdFromUrl", () => {
  it("extracts playlist ID from valid URL", () => {
    assert.equal(
      parsePlaylistIdFromUrl(
        "https://www.youtube.com/playlist?list=PLOftnzGIKwJB1h6ErEcFJTObuqqGNZPXI",
      ),
      "PLOftnzGIKwJB1h6ErEcFJTObuqqGNZPXI",
    );
  });

  it("throws on non-playlist URL", () => {
    assert.throws(
      () =>
        parsePlaylistIdFromUrl("https://www.youtube.com/watch?v=abc123"),
      /Invalid YouTube Playlist URL/,
    );
  });

  it("throws on malformed URL", () => {
    assert.throws(
      () => parsePlaylistIdFromUrl("not-a-url"),
      /Invalid YouTube Playlist URL/,
    );
  });
});
