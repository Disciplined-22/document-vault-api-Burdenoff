import { GraphQLError } from "graphql";
import { PrismaClient, Prisma } from "@prisma/client";

/**
 * GraphQL Context object containing the Prisma Client database connection.
 * Passed to every resolver as the 3rd argument (ctx).
 */
export interface Context {
  prisma: PrismaClient;
}

/**
 * Regular expression validating URL-friendly slugs:
 * Lowercase alphanumeric characters, separated by single hyphens (e.g., "tech-docs", "api-v1").
 * // for later use
 */ 
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const resolvers = {
  // ===========================================================================
  // READ OPERATIONS (Queries)
  // ===========================================================================
  Query: {
    /**
     * Fetches all collections ordered by creation date in descending order (newest first).
     */   /**
     * 
     */ 


     collections: async (_: unknown, args: { take?: number }, ctx: Context) => {
        const limit = args.take && args.take > 0 ? Math.min(args.take, 10) : 10; // added the max limit
        return ctx.prisma.collection.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
        });
      },
    /**
     * Fetches a single collection by its unique ID.
     * Throws GraphQLError with code 'NOT_FOUND' if the collection does not exist.
     */
    collection: async (_: unknown, args: { id: string }, ctx: Context) => {
      const collection = await ctx.prisma.collection.findUnique({
        where: { id: args.id },
      });

      if (!collection) {
        throw new GraphQLError(`Collection with ID "${args.id}" not found.`, {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return collection;
    },



    documents: async (
        _: unknown,
        args: {
          collectionId?: string;
          search?: string;
          isArchived?: boolean;
          take?: number;
          cursor?: string;
        },
        ctx: Context
      ) => {
        // Establish default page size (10) and cap maximum allowed limit at 100
        const limit = args.take && args.take > 0 ? Math.min(args.take, 100) : 10;
        
        // Strongly-typed Prisma condition container (Strict mode compliant - zero 'any')
        const where: Prisma.DocumentWhereInput = {};
  
        // Filter by parent collection if provided
        if (args.collectionId) {
          where.collectionId = args.collectionId;
        }
  
        // Filter by archived status if provided
        if (typeof args.isArchived === "boolean") {
          where.isArchived = args.isArchived;
        }
  
        // Substring Search Logic
        // Perform case-insensitive search across title or content
        if (args.search && args.search.trim() !== "") {
          const query = args.search.trim();
          where.OR = [
            { title: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
          ];
        }
  
        // . Constructing & Executing the Prisma Query
        // Over-fetch by +1 item (take: limit + 1) to reliably determine if a next page exists
        const queryOptions: Prisma.DocumentFindManyArgs = {
          where,
          take: limit + 1,
          orderBy: { id: "asc" },
        };
  
        // Set cursor pointer and skip the reference item itself if paginating
        if (args.cursor) {
          queryOptions.cursor = { id: args.cursor };
          queryOptions.skip = 1; // <--- Skip the cursor item itself so it isn't duplicated
        }
  
        const items = await ctx.prisma.document.findMany(queryOptions);
  
        // Check if there are extra records past the requested page limit
        const hasNextPage = items.length > limit;
        const nodes = hasNextPage ? items.slice(0, limit) : items;
  
        // Construct Relay Edges (combining each node with its unique cursor)
        const edges = nodes.map((node) => ({
          cursor: node.id,
          node,
        }));
  
        // Set endCursor pointer to the last item in the edge array
        const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;
  
        return {
          edges,
          pageInfo: {
            endCursor,
            hasNextPage,
          },
        };
      },

  },


  // ===========================================================================
  // FIELD RESOLVERS & NESTED RELATIONS
  // ===========================================================================

  Collection: {
    /**
     * Formats JavaScript Date objects to standard ISO 8601 strings to match schema spec (createdAt: String!).
     */
    createdAt: (parent: { createdAt: Date | string }) =>
      parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,

    /**
     * Resolves child documents belonging to this collection, ordered by newest first.
     */
    documents: async (parent: { id: string }, _: unknown, ctx: Context) => {
      return ctx.prisma.document.findMany({
        where: { collectionId: parent.id },
        orderBy: { createdAt: "desc" },
      });
    },
  },

  Document: {
    /**
     * Formats JavaScript Date objects to standard ISO 8601 strings to match schema spec (createdAt: String!).
     */
    createdAt: (parent: { createdAt: Date | string }) =>
      parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,

    /**
     * Resolves the parent Collection object associated with this document's collectionId foreign key.
     */

    // the parent is above collection
    collection: async (parent: { collectionId: string }, _: unknown, ctx: Context) => {
      return ctx.prisma.collection.findUnique({
        where: { id: parent.collectionId },
      });
    },
  },


}; 