import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
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
}, (t) => [uniqueIndex("jobs_owner_url").on(t.userId, t.canonicalUrl), index("jobs_owner_updated").on(t.userId, t.updatedAt)]);

export type JobRecord = typeof jobs.$inferSelect;
