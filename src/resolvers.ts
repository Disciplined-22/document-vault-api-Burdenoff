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
  // WRITE OPERATIONS (Mutations)
  // ===========================================================================
  Mutation: {
    /**
     * Creates a new collection with sanitized input strings.
     * Validates that the name is non-empty and the slug conforms to SLUG_REGEX.
     */
    createCollection: async (
        _: unknown,
        args: { name: string; slug: string },
        ctx: Context
      ) => {
        const cleanName = args.name?.trim();
        const cleanSlug = args.slug?.trim().toLowerCase();
      
        if (!cleanName) {
          throw new GraphQLError("Collection name cannot be empty.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
      
        if (!cleanSlug || !SLUG_REGEX.test(cleanSlug)) {
          throw new GraphQLError(
            "Slug must be lowercase, alphanumeric, and hyphen-separated (e.g., 'tech-docs').",
            { extensions: { code: "BAD_USER_INPUT" } }
          );
        }
      
        try {
          return await ctx.prisma.collection.create({
            data: {
              name: cleanName,
              slug: cleanSlug,
            },
          });
        } catch (error) {
          // Catch Prisma's Unique Constraint Violation
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            throw new GraphQLError(`A collection with slug "${cleanSlug}" already exists.`, {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
          throw error;
        }
      },

    /**
     * Creates a new document within a target collection.
     * Rejects empty title/content and throws NOT_FOUND if the target collection does not exist.
     */
    createDocument: async (
      _: unknown,
      args: {
        title: string;
        content: string;
        tags?: string[];
        collectionId: string;
      },
      ctx: Context
    ) => {
      const cleanTitle = args.title?.trim();
      const cleanContent = args.content?.trim();

      if (!cleanTitle) {
        throw new GraphQLError("Document title cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (!cleanContent) {
        throw new GraphQLError("Document content cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const collectionExists = await ctx.prisma.collection.findUnique({
        where: { id: args.collectionId },
      });

      if (!collectionExists) {
        throw new GraphQLError(
          `Collection with ID "${args.collectionId}" does not exist.`,
          { extensions: { code: "NOT_FOUND" } }
        );
      }

      return ctx.prisma.document.create({
        data: {
          title: cleanTitle,
          content: cleanContent,
          tags: args.tags || [],
          collectionId: args.collectionId,
        },
      });
    },

    /**
     * Dynamically updates specified fields on a document.
     * Checks document existence and rejects empty string updates for title/content.
     */
    updateDocument: async (
      _: unknown,
      args: {
        id: string;
        title?: string;
        content?: string;
        tags?: string[];
        isArchived?: boolean;
      },
      ctx: Context
    ) => {
      const docExists = await ctx.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!docExists) {
        throw new GraphQLError(`Document with ID "${args.id}" not found.`, {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Strongly-typed Prisma update payload container
      const updateData: Prisma.DocumentUpdateInput = {};

      if (args.title !== undefined) {
        const cleanTitle = args.title.trim();
        if (!cleanTitle) {
          throw new GraphQLError("Document title cannot be empty.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        updateData.title = cleanTitle;
      }

      if (args.content !== undefined) {
        const cleanContent = args.content.trim();
        if (!cleanContent) {
          throw new GraphQLError("Document content cannot be empty.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        updateData.content = cleanContent;
      }

      if (args.tags !== undefined) {
        updateData.tags = args.tags;
      }

      if (args.isArchived !== undefined) {
        updateData.isArchived = args.isArchived;
      }

      return ctx.prisma.document.update({
        where: { id: args.id },
        data: updateData,
      });
    },

    /**
     * Hard-deletes a document by ID. Returns true on success.
     * Throws NOT_FOUND if the document does not exist.
     */
    deleteDocument: async (_: unknown, args: { id: string }, ctx: Context) => {
      const docExists = await ctx.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!docExists) {
        throw new GraphQLError(`Document with ID "${args.id}" not found.`, {
          extensions: { code: "NOT_FOUND" },
        });
      }

      await ctx.prisma.document.delete({
        where: { id: args.id },
      });

      return true;
    },

    /**
     * Reassigns a document to a different collection.
     * Verifies that both the document and the target collection exist before moving.
     */
    moveDocument: async (
      _: unknown,
      args: { id: string; collectionId: string },
      ctx: Context
    ) => {
      const docExists = await ctx.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!docExists) {
        throw new GraphQLError(`Document with ID "${args.id}" not found.`, {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const targetCollectionExists = await ctx.prisma.collection.findUnique({
        where: { id: args.collectionId },
      });

      if (!targetCollectionExists) {
        throw new GraphQLError(
          `Target collection with ID "${args.collectionId}" not found.`,
          { extensions: { code: "NOT_FOUND" } }
        );
      }

      return ctx.prisma.document.update({
        where: { id: args.id },
        data: { collectionId: args.collectionId },
      });
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