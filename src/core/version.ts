/** Parse "x.y.z" (ignoring any "-prerelease" suffix). Returns null if not x.y.z. */
function parse(
  v: string,
): { nums: [number, number, number]; pre: boolean } | null {
  const trimmed = v.trim();
  const dashIdx = trimmed.indexOf("-");
  const core = dashIdx === -1 ? trimmed : trimmed.substring(0, dashIdx);
  const pre = dashIdx !== -1;

  const parts = core.split(".");
  if (parts.length !== 3) return null;
  const segmentPattern = /^(0|[1-9]\d*)$/;
  if (!parts.every((p) => segmentPattern.test(p))) return null;
  const nums = parts.map((p) => Number(p));
  return { nums: nums as [number, number, number], pre };
}

/** True if `candidate` is a strictly newer x.y.z release than `current`. */
export function isNewer(candidate: string, current: string): boolean {
  const c = parse(candidate);
  const r = parse(current);
  if (c === null || r === null) return false;

  const [c0, c1, c2] = c.nums;
  const [r0, r1, r2] = r.nums;

  if (c0 > r0) return true;
  if (c0 < r0) return false;
  if (c1 > r1) return true;
  if (c1 < r1) return false;
  if (c2 > r2) return true;
  if (c2 < r2) return false;

  // Same x.y.z: a final (candidate not pre) beats a running prerelease.
  return !c.pre && r.pre;
}
