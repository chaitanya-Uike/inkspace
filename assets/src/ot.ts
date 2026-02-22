export type RetainOp = { type: "retain"; n: number };
export type InsertOp = { type: "insert"; text: string };
export type DeleteOp = { type: "delete"; n: number };
export type Op = RetainOp | InsertOp | DeleteOp;

export function retain(n: number): RetainOp {
  return { type: "retain", n };
}
export function insert(text: string): InsertOp {
  return { type: "insert", text };
}
export function del(n: number): DeleteOp {
  return { type: "delete", n };
}

export function isRetain(op: Op): op is RetainOp {
  return op.type === "retain";
}
export function isInsert(op: Op): op is InsertOp {
  return op.type === "insert";
}
export function isDelete(op: Op): op is DeleteOp {
  return op.type === "delete";
}

export class Operation {
  ops: Op[] = [];
  baseLength = 0;
  targetLength = 0;
  clientID: number = 0;

  retain(n: number): this {
    if (n === 0) return this;
    this.baseLength += n;
    this.targetLength += n;
    const last = this.ops[this.ops.length - 1];
    if (last && isRetain(last)) {
      last.n += n;
    } else {
      this.ops.push(retain(n));
    }
    return this;
  }

  insert(text: string): this {
    if (text === "") return this;
    this.targetLength += text.length;
    const last = this.ops[this.ops.length - 1];
    const secondLast = this.ops[this.ops.length - 2];
    if (last && isInsert(last)) {
      last.text += text;
    } else if (last && isDelete(last)) {
      if (secondLast && isInsert(secondLast)) {
        secondLast.text += text;
      } else {
        this.ops.splice(this.ops.length - 1, 0, insert(text));
      }
    } else {
      this.ops.push(insert(text));
    }
    return this;
  }

  delete(n: number): this {
    if (n === 0) return this;
    this.baseLength += n;
    const last = this.ops[this.ops.length - 1];
    if (last && isDelete(last)) {
      last.n += n;
    } else {
      this.ops.push(del(n));
    }
    return this;
  }

  apply(str: string): string {
    if (str.length !== this.baseLength) {
      throw new Error(
        "The operation's base length must be equal to the string's length",
      );
    }
    const parts: string[] = [];
    let strIndex = 0;
    for (const op of this.ops) {
      if (isRetain(op)) {
        if (strIndex + op.n > str.length) {
          throw new Error(
            "Operation can't retain more characters than are left in the string.",
          );
        }
        parts.push(str.slice(strIndex, strIndex + op.n));
        strIndex += op.n;
      } else if (isInsert(op)) {
        parts.push(op.text);
      } else {
        strIndex += op.n;
      }
    }
    if (strIndex !== str.length) {
      throw new Error("The operation didn't operate on the whole string.");
    }
    return parts.join("");
  }
}

export function transform(
  operation1: Operation,
  operation2: Operation,
): [Operation, Operation] {
  if (operation1.baseLength !== operation2.baseLength) {
    throw new Error("Both operations have to have the same base length");
  }

  const op1Prime = new Operation();
  op1Prime.clientID = operation1.clientID;
  const op2Prime = new Operation();
  op2Prime.clientID = operation2.clientID;

  const ops1 = operation1.ops;
  const ops2 = operation2.ops;
  let i1 = 0;
  let i2 = 0;
  let o1 = ops1[i1++];
  let o2 = ops2[i2++];

  while (true) {
    if (!o1 && !o2) break;

    if (
      o1 &&
      isInsert(o1) &&
      (!o2 || !isInsert(o2) || operation1.clientID > operation2.clientID)
    ) {
      op1Prime.insert(o1.text);
      op2Prime.retain(o1.text.length);
      o1 = ops1[i1++];
      continue;
    }
    if (o2 && isInsert(o2)) {
      op1Prime.retain(o2.text.length);
      op2Prime.insert(o2.text);
      o2 = ops2[i2++];
      continue;
    }

    if (!o1)
      throw new Error(
        "Cannot compose operations: first operation is too short.",
      );
    if (!o2)
      throw new Error(
        "Cannot compose operations: first operation is too long.",
      );

    if (isRetain(o1) && isRetain(o2)) {
      const minL = Math.min(o1.n, o2.n);
      o1.n -= minL;
      o2.n -= minL;
      if (o1.n === 0) o1 = ops1[i1++];
      if (o2.n === 0) o2 = ops2[i2++];
      op1Prime.retain(minL);
      op2Prime.retain(minL);
    } else if (isDelete(o1) && isDelete(o2)) {
      const minL = Math.min(o1.n, o2.n);
      o1.n -= minL;
      o2.n -= minL;
      if (o1.n === 0) o1 = ops1[i1++];
      if (o2.n === 0) o2 = ops2[i2++];
    } else if (isDelete(o1) && isRetain(o2)) {
      const minL = Math.min(o1.n, o2.n);
      o1.n -= minL;
      o2.n -= minL;
      if (o1.n === 0) o1 = ops1[i1++];
      if (o2.n === 0) o2 = ops2[i2++];
      op1Prime.delete(minL);
    } else if (isRetain(o1) && isDelete(o2)) {
      const minL = Math.min(o1.n, o2.n);
      o1.n -= minL;
      o2.n -= minL;
      if (o1.n === 0) o1 = ops1[i1++];
      if (o2.n === 0) o2 = ops2[i2++];
      op2Prime.delete(minL);
    } else {
      throw new Error("The two operations aren't compatible");
    }
  }

  return [op1Prime, op2Prime];
}

// Wire format: positive int = retain, negative int = delete, string = insert

export type WireOp = string | number;

export interface OperationData {
  cid: number;
  ops: WireOp[];
  base: number;
  target: number;
}

export function serializeOperation(op: Operation): OperationData {
  return {
    cid: op.clientID,
    base: op.baseLength,
    target: op.targetLength,
    ops: op.ops.map((o) => {
      if (isRetain(o)) return o.n;
      if (isInsert(o)) return o.text;
      return -o.n;
    }),
  };
}

export function deserializeOperation(data: OperationData): Operation {
  const op = new Operation();
  op.clientID = data.cid;
  op.baseLength = data.base;
  op.targetLength = data.target;
  for (const raw of data.ops) {
    if (typeof raw === "string") {
      op.ops.push(insert(raw));
    } else if (raw > 0) {
      op.ops.push(retain(raw));
    } else if (raw < 0) {
      op.ops.push(del(-raw));
    } else {
      throw new Error("Invalid op in deserialization: 0 is not a valid op");
    }
  }
  return op;
}
