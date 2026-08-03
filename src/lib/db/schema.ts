import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey().default('default'),
  name: text('name').notNull(),
  title: text('title').notNull(),
  terminalPrompt: text('terminal_prompt'),
  bio: text('bio').notNull(),
  portfolioBio: text('portfolio_bio').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  faviconUrl: text('favicon_url'),
  skills: jsonb('skills').$type<{ name: string; level: 'low' | 'medium' | 'high' }[]>().default([]),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull().default('General'),
  tags: jsonb('tags').$type<string[]>().default([]),
  draft: boolean('draft').notNull().default(false),
  pubDate: text('pub_date').notNull(),
  coverImage: text('cover_image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
