export function createHistory({ capture, restore, limit = 100 }) {
  let snapshots = [JSON.stringify(capture())], index = 0, restoring = false;
  function checkpoint() {
    if (restoring) return;
    const next = JSON.stringify(capture());
    if (next === snapshots[index]) return;
    snapshots = snapshots.slice(0, index + 1);
    snapshots.push(next);
    if (snapshots.length > limit) snapshots.shift();
    index = snapshots.length - 1;
  }
  function apply(next) {
    if (next < 0 || next >= snapshots.length) return;
    restoring = true;
    try { index = next; restore(JSON.parse(snapshots[index])); }
    finally { restoring = false; }
  }
  return { checkpoint, undo: () => { checkpoint(); apply(index - 1); }, redo: () => { checkpoint(); apply(index + 1); } };
}
