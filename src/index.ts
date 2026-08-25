import { createYoga, createSchema } from "graphql-yoga";
import { PrismaClient } from "@prisma/client";
import { resolvers } from "./resolvers.ts";

/**
 * Instantiate the Prisma Client to manage connection pooling 
 * and database queries across the application.
 */
const prisma = new PrismaClient();

/**
 * Asynchronously load the GraphQL SDL (Schema Definition Language) string
 * directly from disk using Bun's native top-level await file API.
 */
const typeDefs = await Bun.file("src/schema.graphql").text();

/**
 * Initialize the GraphQL Yoga engine by binding the executable schema
 * and injecting global request context (Prisma DB client).
 */
const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  // Dependency injection: Attach Prisma instance to the request context
  // making it available in all resolvers via the 3rd parameter `ctx.prisma`
  context: {
    prisma,
  },
});

/**
 * Spin up Bun's native HTTP server instance bound to port 4000
 * and route incoming network requests directly through the Yoga instance.
 */
const server = Bun.serve({
  port: 4000,
  fetch: yoga,
});

console.log(`🚀 GraphQL Server running on http://localhost:${server.port}/graphql`);