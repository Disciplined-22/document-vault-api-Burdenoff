import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client instance for direct database operations during integration testing
const prisma = new PrismaClient();

describe("Integration Tests: E2E Database Operations", () => {
  // Shared state variables to pass created IDs between sequential CRUD steps
  let collectionId: string;
  let documentId: string;

  /**
   * SAFETY & ISOLATION HOOK (beforeAll)
   * Before running the test suite, clear existing documents and collections.
   * Note: This prevents foreign key constraint issues during test initialization 
   * and guarantees a clean, deterministic state regardless of pre-existing DB rows.
   */
  beforeAll(async () => {
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();
  });

  /**
   * TEARDOWN & CLEANUP HOOK (afterAll)
   * Wipe test data generated during execution and safely disconnect the client.
   */
  afterAll(async () => {
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.$disconnect();
  });

  test("1. Create Collection in PostgreSQL", async () => {
    // Attempt direct record creation in database
    const collection = await prisma.collection.create({
      data: {
        name: "Integration Test Vault",
        slug: "integration-test-vault",
      },
    });

    // Assert that primary key and slug fields persist correctly
    expect(collection.id).toBeDefined();
    expect(collection.slug).toBe("integration-test-vault");

    // Capture collection ID for child document creation in Test 2
    collectionId = collection.id;
  });

  test("2. Create Document linked to Collection", async () => {
    // Create child document referencing parent collectionId
    const doc = await prisma.document.create({
      data: {
        title: "Tokio Scheduler Internals",
        content: "Detailed mechanics of work-stealing thread pools.",
        tags: ["rust", "async"],
        collectionId,
      },
    });

    // Assert relation assignment and default field values
    expect(doc.id).toBeDefined();
    expect(doc.collectionId).toBe(collectionId);
    expect(doc.isArchived).toBe(false);

    // Capture document ID for deletion in Test 4
    documentId = doc.id;
  });

  test("3. Fetch Paginated Documents", async () => {
    // Query documents filtered by collectionId
    const docs = await prisma.document.findMany({
      where: { collectionId },
      take: 10,
    });

    // Verify record retrieval match
    expect(docs.length).toBe(1);
    expect(docs[0].title).toBe("Tokio Scheduler Internals");
  });

  test("4. Delete Document from PostgreSQL", async () => {
    // Hard-delete document using captured documentId
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Verify record no longer exists in PostgreSQL database
    const found = await prisma.document.findUnique({
      where: { id: documentId },
    });

    expect(found).toBeNull();
  });
});