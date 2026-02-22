import { OperationData } from "./ot";
import { Selection } from "./selection";

export interface BaseMessage<T extends string, P> {
  type: T;
  payload: P;
}

export type JoinedRoomMessage = BaseMessage<
  "joined-room",
  { clientId: string; roomId: string; state: string; revision: number }
>;

export type RemoteOperationMessage = BaseMessage<
  "remote-operation",
  { operation: OperationData; revision: number }
>;

export type AckOperationMessage = BaseMessage<
  "ack-operation",
  { revision: number }
>;

export type RemoteSelectionMessage = BaseMessage<
  "remote-selection",
  { clientId: string; selection: Selection; revision: number }
>;

export type ClientDisconnectedMessage = BaseMessage<
  "client-disconnected",
  { clientId: string }
>;

export type ErrorMessage = BaseMessage<"error", string>;

export type ServerMessage =
  | JoinedRoomMessage
  | RemoteOperationMessage
  | RemoteSelectionMessage
  | AckOperationMessage
  | ClientDisconnectedMessage
  | ErrorMessage;
