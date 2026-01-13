import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.string(),
  }),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    ownerId: v.string(),
  }),
});
