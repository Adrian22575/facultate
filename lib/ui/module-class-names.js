export function moduleClassNames(styleMaps, value) {
  const maps = Array.isArray(styleMaps) ? styleMaps : [styleMaps];
  const tokens = String(value || "").split(/\s+/).filter(Boolean);
  const resolved = [];

  for (const token of tokens) {
    resolved.push(token);
    for (const styles of maps) {
      const localClassName = styles?.[token];
      if (localClassName && !resolved.includes(localClassName)) resolved.push(localClassName);
    }
  }

  return resolved.join(" ");
}
