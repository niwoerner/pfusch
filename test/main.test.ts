import { test } from "node:test";
import assert from "node:assert/strict";
import { greet } from "../src/main.ts";

test("greet", () => {
  assert.equal(greet("Chord"), "Hello, Chord!");
});
