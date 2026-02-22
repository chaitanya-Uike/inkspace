import { isInsert, isRetain, Operation } from "./ot";

export type Selection = {
  anchor: number;
  head: number;
};

export function transformSelection(
  selection: Selection,
  operation: Operation,
): Selection {
  function transformIndex(index: number): number {
    let newIndex = index;
    const ops = operation.ops;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (isRetain(op)) {
        index -= op.n;
      } else if (isInsert(op)) {
        newIndex += op.text.length;
      } else {
        newIndex -= Math.min(index, op.n);
        index -= op.n;
      }
      if (index < 0) break;
    }
    return newIndex;
  }

  const newAnchor = transformIndex(selection.anchor);
  if (selection.anchor == selection.head) {
    return { anchor: newAnchor, head: newAnchor };
  }
  return { anchor: newAnchor, head: transformIndex(selection.head) };
}
