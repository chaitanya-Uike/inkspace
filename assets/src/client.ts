import { Operation, serializeOperation, transform } from "./ot";
import { transformSelection, type Selection } from "./selection";

type PushFn = (event: string, payload: unknown) => void;

export class Client {
  state: string;
  clientID: string;
  revision: number;
  sentOperation: Operation | null;
  pendingOperations: Operation[];
  private push: PushFn;

  constructor(id: string, initState: string, revision: number, push: PushFn) {
    this.clientID = id;
    this.state = initState;
    this.revision = revision;
    this.sentOperation = null;
    this.pendingOperations = [];
    this.push = push;
  }

  applyLocalOperation(operation: Operation) {
    this.state = operation.apply(this.state);
    if (!this.sentOperation) {
      this.sendOperation(operation);
    } else {
      this.pendingOperations.push(operation);
    }
  }

  applyRemoteOperation(remoteOperation: Operation, serverRevision: number) {
    this.revision = serverRevision;
    if (this.sentOperation) {
      [this.sentOperation, remoteOperation] = transform(
        this.sentOperation,
        remoteOperation,
      );
    }
    const newPending: Operation[] = [];
    for (let pendingOperation of this.pendingOperations) {
      [pendingOperation, remoteOperation] = transform(
        pendingOperation,
        remoteOperation,
      );
      newPending.push(pendingOperation);
    }
    this.pendingOperations = newPending;
    this.state = remoteOperation.apply(this.state);
  }

  handleAck(serverRevision: number) {
    this.revision = serverRevision;
    this.sentOperation = null;
    if (this.pendingOperations.length > 0) {
      this.sendOperation(this.pendingOperations.shift()!);
    }
  }

  transformRemoteSelection(selection: Selection): Selection {
    let transformed = selection;
    if (this.sentOperation) {
      transformed = transformSelection(transformed, this.sentOperation);
    }
    for (const pending of this.pendingOperations) {
      transformed = transformSelection(transformed, pending);
    }
    return transformed;
  }

  sendSelection(selection: Selection) {
    this.push("selection", {
      clientID: this.clientID,
      selection,
      revision: this.revision,
    });
  }

  private sendOperation(operation: Operation) {
    this.sentOperation = operation;
    this.push("operation", {
      operation: serializeOperation(operation),
      revision: this.revision,
    });
  }
}
