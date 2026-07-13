import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
  // Lager & Kalkulation
  costPrice: integer("cost_price").notNull().default(0),
  stockTarget: integer("stock_target").notNull().default(0),
  stockCurrent: integer("stock_current").notNull().default(0),
  recipeVisible: boolean("recipe_visible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingredients = pgTable("ingredients", {
  id: serial().primaryKey(),
  name: text().notNull(),
  stockTarget: integer("stock_target").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  stockCurrent: integer("stock_current").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipeItems = pgTable("recipe_items", {
  id: serial().primaryKey(),
  menuItemId: integer("menu_item_id").notNull(),
  ingredientId: integer("ingredient_id").notNull(),
  amount: integer().notNull().default(1),
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

export const vipTicketTypes = pgTable("vip_ticket_types", {
  id: serial().primaryKey(),
  name: text().notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  price: integer().notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vipTickets = pgTable("vip_tickets", {
  id: serial().primaryKey(),
  holderName: text("holder_name").notNull(),
  ticketTypeId: integer("ticket_type_id").notNull(),
  issuedAt: text("issued_at").notNull(),
  notes: text().notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const financeEntries = pgTable("finance_entries", {
  id: serial().primaryKey(),
  entryDate: text("entry_date").notNull(),
  description: text().notNull(),
  amount: integer().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const infoNotes = pgTable("info_notes", {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull().default(""),
  pinned: boolean().notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
