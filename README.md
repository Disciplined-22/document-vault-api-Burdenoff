# Document Vault GraphQL API

A production-grade, schema-first GraphQL API for managing document vaults and collections, built with Bun, TypeScript (strict mode), GraphQL Yoga, Prisma, and Dockerized PostgreSQL.

## Tech Stack
- **Runtime:** Bun
- **Language:** TypeScript (Strict Mode)
- **API Engine:** GraphQL Yoga (Schema-First)
- **Database:** PostgreSQL (Dockerized)
- **ORM:** Prisma

---

## Quick Start (One-Command Setup)

Run the following command in your terminal to spin up the database container, install dependencies, run migrations, and start the development server:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

## Verification & QA

The GraphQL Yoga server will be available at:

`http://localhost:4000/graphql`

To execute strict type-checking (`tsc --noEmit`) and run both unit and integration test suites sequentially, run:

```bash
bun run sanity
```


## Future Extensions

If extending this system for high-scale production, key priorities include:

1. **Authentication & RBAC:** Integrate JWT/OAuth2 middleware inside the GraphQL Yoga context to enforce role-based access control per collection and document resource.

2. **Search Optimization:** Replace substring `contains` matching with PostgreSQL Native Full-Text Search (`tsvector`/`tsquery`) for scalable, low-latency search indexing.

3. **Caching Layer:** Introduce a Redis cache layer for heavily-read queries using GraphQL Yoga response caching plugins.


## Walkthrough Link

- **Written Walkthrough & PR Details:** [https://github.com/Disciplined-22/document-vault-api-Burdenoff/pull/1](https://github.com/Disciplined-22/document-vault-api-Burdenoff/pull/1)
