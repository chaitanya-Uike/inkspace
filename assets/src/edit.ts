import { Operation } from "./ot";

export function findEdits(source: string, target: string): Operation {
  let prefixLen = 0;
  const minLen = Math.min(source.length, target.length);
  while (prefixLen < minLen && source[prefixLen] === target[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  let sourceEnd = source.length;
  let targetEnd = target.length;
  while (
    suffixLen < minLen - prefixLen &&
    source[sourceEnd - 1 - suffixLen] === target[targetEnd - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const sourceMiddle = source.slice(prefixLen, sourceEnd - suffixLen);
  const targetMiddle = target.slice(prefixLen, targetEnd - suffixLen);

  const operation = new Operation();
  if (prefixLen > 0) operation.retain(prefixLen);
  if (sourceMiddle.length > 0 || targetMiddle.length > 0) {
    computeEdits(operation, sourceMiddle, targetMiddle);
  }
  if (suffixLen > 0) operation.retain(suffixLen);

  return operation;
}

function computeEdits(operation: Operation, source: string, target: string) {
  const n1 = source.length;
  const n2 = target.length;

  if (n1 === 0 && n2 === 0) return;
  if (n1 === 0) {
    operation.insert(target);
    return;
  }
  if (n2 === 0) {
    operation.delete(source.length);
    return;
  }

  const dp: number[][] = Array.from({ length: n1 + 1 }, () =>
    new Array(n2 + 1).fill(0),
  );
  for (let i = n1 - 1; i >= 0; i--) {
    for (let j = n2 - 1; j >= 0; j--) {
      if (source[i] === target[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = 0;
  let j = 0;
  while (i < n1 && j < n2) {
    if (source[i] === target[j]) {
      operation.retain(1);
      i++;
      j++;
    } else if (dp[i][j] === dp[i + 1][j]) {
      operation.delete(1);
      i++;
    } else {
      operation.insert(target[j]);
      j++;
    }
  }

  if (i < n1) operation.delete(n1 - i);
  if (j < n2) operation.insert(target.slice(j));
}
