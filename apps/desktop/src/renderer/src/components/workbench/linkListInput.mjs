import { recognizeVideoInput } from "./videoInput.mjs";

export function parseLinkList(text) {
  // Blank comments without changing line numbers used in the import report.
  const source = String(text || "").replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, value => value.replace(/[^\r\n]/g, " "));
  const entries = [], invalid = [];
  source.split(/\r\n|\n|\r/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || /^#{1,6}(?:\s|$)/.test(line) || /^(?:`{3,}|~{3,})/.test(line)) return;
    const value = line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s+)?/, "");
    const target = recognizeVideoInput(value);
    if (target.error || /^!\[/.test(value)) {
      invalid.push({ line: index + 1, error: target.error === "multipleVideoSources" ? "oneLinkPerLine" : "invalidLinkLine" });
    } else {
      entries.push({ url: target.url, line: index + 1 });
    }
  });
  return { entries, invalid };
}
