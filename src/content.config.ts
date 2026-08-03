// src/content.config.ts — Astro 6 format
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
    loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/posts" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        tags: z.array(z.string()).default([]),
        category: z.string().default("General"),
        draft: z.boolean().default(false),
        coverImage: z.string().optional(),
    }),
});

export const collections = { posts };
