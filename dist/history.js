export function createHistory({ capture, restore, limit = 100, onChange = () => {} }) {
  let snapshots = [JSON.stringify(capture())], index = 0, restoring = false;
  const notify = () => onChange({ canUndo: index > 0, canRedo: index < snapshots.length - 1 });
  function checkpoint() {
    if (restoring) return;
    const next = JSON.stringify(capture());
    if (next === snapshots[index]) { notify(); return; }
    snapshots = snapshots.slice(0, index + 1);
    snapshots.push(next);
    if (snapshots.length > limit) snapshots.shift();
    index = snapshots.length - 1;
    notify();
  }
  function apply(next) {
    if (next < 0 || next >= snapshots.length) return;
    restoring = true;
    try { index = next; restore(JSON.parse(snapshots[index])); }
    finally { restoring = false; notify(); }
  }
  notify();
  return { checkpoint, undo: () => { checkpoint(); apply(index - 1); }, redo: () => { checkpoint(); apply(index + 1); } };
}
