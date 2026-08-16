import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const snapshotArgs = {
  beforeCommit: v.string(),
  afterCommit: v.string(),
  schemaHash: v.string(),
  archiveName: v.string(),
  sizeBytes: v.number(),
  storageId: v.id("_storage"),
} as const;

export const generateUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const record = internalMutation({
  args: snapshotArgs,
  returns: v.id("backupSnapshots"),
  handler: async (ctx, args) => {
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new Error("Snapshot storage file was not found");
    }

    return await ctx.db.insert("backupSnapshots", {
      environment: "prod",
      reason: "schema-change",
      storageId: args.storageId,
      beforeCommit: args.beforeCommit,
      afterCommit: args.afterCommit,
      schemaHash: args.schemaHash,
      createdAt: Date.now(),
      archiveName: args.archiveName,
      sizeBytes: args.sizeBytes,
    });
  },
});

export const list = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const safeLimit = Math.max(1, Math.min(limit ?? 50, 200));
    return await ctx.db
      .query("backupSnapshots")
      .withIndex("by_created_at")
      .order("desc")
      .take(safeLimit);
  },
});