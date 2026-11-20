import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("admin_users_email_idx").on(table.email)]);

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("admin_sessions_token_idx").on(table.tokenHash), index("admin_sessions_user_idx").on(table.userId)]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 16 }).default("#6C72F5").notNull(),
  createdAt: createdAt(),
});

export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  region: varchar("region", { length: 100 }).default("—").notNull(),
  role: varchar("role", { length: 20 }).default("origin").notNull(),
  status: varchar("status", { length: 20 }).default("offline").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  logoUrl: text("logo_url"),
  kind: varchar("kind", { length: 10 }).default("live").notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  nodeId: integer("node_id").references(() => nodes.id, { onDelete: "set null" }),
  enabled: integer("enabled").default(1).notNull(),
  health: varchar("health", { length: 20 }).default("pending").notNull(),
  createdAt: createdAt(),
}, (table) => [index("streams_node_idx").on(table.nodeId), index("streams_category_idx").on(table.categoryId)]);

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  username: varchar("username", { length: 80 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).default("active").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  playlistHits: integer("playlist_hits").default(0).notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("subscribers_username_idx").on(table.username), uniqueIndex("subscribers_token_idx").on(table.tokenHash)]);

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 32 }).notNull(),
  message: text("message").notNull(),
  actor: varchar("actor", { length: 120 }).default("النظام").notNull(),
  createdAt: createdAt(),
}, (table) => [index("activity_logs_created_idx").on(table.createdAt)]);
