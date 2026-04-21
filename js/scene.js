const listeners = new Set();
let current = 'iceberg';

export function getScene() {
  return current;
}

export function setScene(name) {
  if (name === current) return;
  current = name;
  for (const fn of listeners) fn(current);
}

export function onSceneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
