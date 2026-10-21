import { pgTable, text, integer, uniqueIndex, index, customType, timestamp, jsonb } from "drizzle-orm/pg-core";
import type { CareerProfile } from "@/lib/profile";
import type { ActivityKind } from "@/lib/activity";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const users = pgTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(), name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(), role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"), createdAt: text("created_at").notNull(),
  theme: text("theme").notNull().default("dark"),
  applicationPageSize: integer("application_page_size").notNull().default(10),
});
export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<CareerProfile>().notNull(),
  revision: integer("revision").notNull().default(1), updatedAt: text("updated_at").notNull(),
});
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [index("sessions_user").on(t.userId)]);

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  shortId: text("short_id").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  canonicalHash: text("canonical_hash").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  workMode: text("work_mode").notNull().default("Unspecified"),
  salary: text("salary").notNull().default(""),
  description: text("description").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("Saved"),
  deadline: text("deadline"),
  appliedAt: text("applied_at"),
  resumeKey: text("resume_key"),
  resumeName: text("resume_name"),
  resumeType: text("resume_type"),
  resumeSize: integer("resume_size"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("jobs_owner_url").on(t.userId, t.canonicalHash), index("jobs_owner_updated").on(t.userId, t.updatedAt)]);

export type JobRecord = typeof jobs.$inferSelect;

export const jobActivity = pgTable("job_activity", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  kind: text("kind").$type<ActivityKind>().notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  label: text("label").notNull().default(""), notes: text("notes").notNull().default(""), source: text("source").notNull().default("recorded"),
}, t => [index("job_activity_job_date").on(t.jobId, t.occurredAt), uniqueIndex("job_activity_milestone").on(t.jobId, t.kind).where(sql`${t.kind} <> 'interview_completed'`)]);

export const resumes = pgTable("resumes", {
  jobId: text("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }), data: bytea("data").notNull(),
});
export const authLimits = pgTable("auth_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
});
