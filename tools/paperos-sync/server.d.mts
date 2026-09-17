import type { WebSocket } from "ws";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";

export interface SyncRoom {
  doc: Y.Doc;
  awareness: Awareness;
  conns: Map<WebSocket, Set<number>>;
}

export interface SyncServer {
  port: number;
  host: string;
  rooms: Map<string, SyncRoom>;
  close(): Promise<void>;
}

export function startSyncServer(options?: {
  port?: number;
  host?: string;
  log?: (line: string) => void;
}): Promise<SyncServer>;
