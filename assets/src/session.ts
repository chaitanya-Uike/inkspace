import { Client } from "./client";
import { findEdits } from "./edit";
import { Editor } from "./editor";
import { deserializeOperation, Operation } from "./ot";
import { Selection, transformSelection } from "./selection";
import { ServerMessage } from "./types";
import { getWebSocketUrl } from "./utils";

export class CollabSession {
  private socket: WebSocket;
  private client: Client | null = null;
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
    this.socket = this.connect();
  }

  private connect(): WebSocket {
    const socket = new WebSocket(getWebSocketUrl());

    socket.addEventListener("open", () => {
      const roomId = window.location.hash.slice(1) || "";
      this.send("join", { roomId });
    });

    socket.addEventListener("message", (event) => {
      try {
        this.handleMessage(JSON.parse(event.data) as ServerMessage);
      } catch {
        console.error("Failed to parse message:", event.data);
      }
    });

    socket.addEventListener("close", () =>
      console.log("WebSocket disconnected"),
    );
    socket.addEventListener("error", (err) =>
      console.error("WebSocket error:", err),
    );

    return socket;
  }

  send(type: string, payload: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "joined-room": {
        const { clientId, roomId, state, revision } = msg.payload;
        this.editor.setContent(state);
        this.client = new Client(
          clientId,
          this.editor.getContent(),
          revision,
          this.send.bind(this),
        );
        window.location.hash = roomId;
        break;
      }

      case "ack-operation":
        this.client?.handleAck(msg.payload.revision);
        break;

      case "remote-operation": {
        if (!this.client) return;
        const op = deserializeOperation(msg.payload.operation);
        this.client.applyRemoteOperation(op, msg.payload.revision);
        this.editor.setContent(this.client.state);
        this.transformStaleSelections(op);
        break;
      }

      case "remote-selection": {
        if (!this.client) return;
        const { clientId, selection } = msg.payload;
        this.editor.setRemoteUser({
          id: clientId,
          label: "Client",
          selection: this.client.transformRemoteSelection(selection),
        });
        break;
      }

      case "client-disconnected":
        this.editor.removeRemoteUser(msg.payload.clientId);
        break;

      case "error":
        console.error("Server error:", msg.payload);
        break;
    }
  }

  onContentChange(newContent: string): void {
    if (!this.client) return;

    const operation = findEdits(this.client.state, newContent);
    operation.clientID = this.client.clientID;
    this.client.applyLocalOperation(operation);

    this.transformStaleSelections(operation);
  }

  onSelectionChange(selection: Selection): void {
    this.client?.sendSelection(selection);
  }

  private transformStaleSelections(operation: Operation) {
    for (const user of this.editor.getRemoteUsers()) {
      this.editor.setRemoteUser({
        ...user,
        selection: transformSelection(user.selection, operation),
      });
    }
  }
}
