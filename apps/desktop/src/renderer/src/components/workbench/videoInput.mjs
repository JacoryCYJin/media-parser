const urlTokens = /https?:\/\/[^\s<>"'`，。；！？（）【】]+|(?<![\w./-])(?:www\.|m\.|music\.)?(?:bilibili\.com|b23\.tv|youtube\.com|youtu\.be)\/[^\s<>"'`，。；！？（）【】]+/gi;
const idTokens = /(?<![A-Za-z0-9_])(?:BV[A-Za-z0-9]{10}|av\d+)(?![A-Za-z0-9_])/gi;
const tracking = /^(?:utm_.+|spm_id_from|si|feature|share_source|share_medium|share_plat|share_session_id|share_tag)$/i;

function canonicalUrl(value) {
  const token = value.replace(/[)\]},.!?:;]+$/, "");
  const url = new URL(/^https?:\/\//i.test(token) ? token : `https://${token}`);
  if (!url.hostname || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  const host = url.hostname.toLowerCase();
  const youtube = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host);
  const shortYoutube = host === "youtu.be" || host === "www.youtu.be";
  const segments = url.pathname.split("/").filter(Boolean);
  const id = shortYoutube ? segments[0] : youtube ? (url.searchParams.get("v") || (["shorts", "live", "embed", "v"].includes(segments[0]) ? segments[1] : "")) : "";
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    url.protocol = "https:";
    url.hostname = "www.youtube.com";
    url.pathname = "/watch";
    url.searchParams.delete("v");
    const rest = url.searchParams.toString();
    url.search = `v=${id}${rest ? `&${rest}` : ""}`;
  }
  if (["bilibili.com", "www.bilibili.com", "m.bilibili.com"].includes(host) && /^\/video\/(?:BV[A-Za-z0-9]{10}|av\d+)\/?$/i.test(url.pathname)) {
    url.protocol = "https:";
    url.hostname = "www.bilibili.com";
    url.pathname = url.pathname.replace(/\/$/, "").replace(/\/bv/i, "/BV").replace(/\/AV/i, "/av");
  }
  // Remove only known tracking fields; keep part, timestamp and selection parameters.
  if (youtube || shortYoutube || ["bilibili.com", "www.bilibili.com", "m.bilibili.com", "b23.tv"].includes(host)) {
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}

export function recognizeVideoInput(input) {
  const raw = String(input ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!raw) return { error: "missing" };
  const candidates = [];
  const add = (value) => { try { candidates.push(canonicalUrl(value)); } catch { /* Invalid candidates are handled below. */ } };
  const remainder = raw.replace(urlTokens, (token) => { add(token); return " "; });
  for (const match of remainder.matchAll(idTokens)) {
    const id = match[0];
    add(`https://www.bilibili.com/video/${/^bv/i.test(id) ? `BV${id.slice(2)}` : id.toLowerCase()}`);
  }
  if (!candidates.length && /^[A-Za-z0-9_-]{11}$/.test(raw)) add(`https://www.youtube.com/watch?v=${raw}`);
  const unique = [...new Map(candidates.map((url) => {
    const key = new URL(url);
    key.searchParams.sort();
    return [key.href, url];
  })).values()];
  if (!unique.length) return { error: "invalidVideoInput" };
  if (unique.length > 1) return { error: "multipleVideoSources" };
  return { url: unique[0] };
}
