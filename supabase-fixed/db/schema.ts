import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const applications = pgTable("applications", {
  id: serial().primaryKey(),
  fullName: text("full_name").notNull(),
  age: text().notNull(),
  phone: text().notNull(),
  position: text().notNull(),
  motivation: text().notNull(),
  experience: text().notNull(),
  guestExperience: text("guest_experience").notNull(),
  availability: text().notNull(),
  contactPreference: text("contact_preference").notNull(),
  status: text().notNull().default("neu"),
  adminNotes: text("admin_notes").notNull().default(""),
  applicationFolder: text("application_folder").notNull().default("neu"),
  customAnswers: text("custom_answers").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial().primaryKey(),
  name: text().notNull(),
  role: text().notNull(),
  expertise: text().notNull().default(""),
  description: text().notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactRequests = pgTable("contact_requests", {
  id: serial().primaryKey(),
  nameOrCompany: text("name_or_company").notNull(),
  contactMethod: text("contact_method").notNull(),
  requestType: text("request_type").notNull(),
  subject: text().notNull(),
  message: text().notNull(),
  folder: text().notNull().default("neu"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuItems = pgTable("menu_items", {
  id: serial().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  category: text().notNull(),
  price: integer().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial().primaryKey(),
  eventDate: text("event_date").notNull(),
  startTime: text("start_time").notNull(),
  name: text().notNull(),
  description: text().notNull().default(""),
  status: text().notNull().default("in-planung"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentBlocks = pgTable("content_blocks", {
  id: serial().primaryKey(),
  section: text().notNull().default("home"),
  title: text().notNull(),
  body: text().notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
