import { browserStorage } from "@/wm/storage";
import {
  createWorkspaceStore,
  type WorkspaceStore,
} from "@/wm/workspace-store";

let store: WorkspaceStore | null = null;

/** The app-wide workspace store (localStorage-backed, created on first use). */
export function getWorkspaceStore(): WorkspaceStore {
  if (!store) store = createWorkspaceStore(browserStorage());
  return store;
}
