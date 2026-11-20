export type StreamRecord = {
  id: number;
  name: string;
  sourceUrl: string;
  logoUrl: string | null;
  kind: string;
  categoryId: number | null;
  nodeId: number | null;
  enabled: number;
  health: string;
  createdAt: string;
};

export type CategoryRecord = {
  id: number;
  name: string;
  color: string;
  createdAt: string;
};

export type NodeRecord = {
  id: number;
  name: string;
  address: string;
  region: string;
  role: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
};

export type SubscriberRecord = {
  id: number;
  name: string;
  username: string;
  status: string;
  expiresAt: string | null;
  playlistHits: number;
  createdAt: string;
};

export type ActivityRecord = {
  id: number;
  action: string;
  message: string;
  actor: string;
  createdAt: string;
};

export type ConsoleData = {
  streams: StreamRecord[];
  categories: CategoryRecord[];
  nodes: NodeRecord[];
  subscribers: SubscriberRecord[];
  activity: ActivityRecord[];
  viewer: { name: string; email: string } | null;
  demo: boolean;
};

export type TabKey = "overview" | "streams" | "library" | "subscribers" | "nodes" | "activity" | "settings";
