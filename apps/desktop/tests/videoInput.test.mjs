import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recognizeVideoInput } from "../src/renderer/src/components/workbench/videoInput.mjs";
const cases = JSON.parse(readFileSync(new URL("../../../services/media-core/tests/video_input_cases.json", import.meta.url)));
for (const { input, ...expected } of cases) {
  test(`recognize ${JSON.stringify(input)}`, () => assert.deepEqual(recognizeVideoInput(input), expected));
}
