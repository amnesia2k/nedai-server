# NedAI Backend V1 Plan

## Hono.js + PostgreSQL + Prisma + OpenAI + UploadThing

## 1. Goal

Build a lightweight backend for **NedAI** that:

- supports **user accounts**
- stores uploaded **PDFs and DOCX files**
- extracts and chunks educational content
- creates **embeddings** for retrieval
- stores vectors in **PostgreSQL** using **pgvector**
- retrieves relevant chunks for a user query
- sends the retrieved context to **Groq** for final answer generation
- returns grounded answers for the mobile app

This replaces the fragile on-device React Native Llama loading path with a simpler and more reliable online architecture. Knowledge sources from the mobile app are being moved to the server for embedding (RAG).

---

## Knowledge Sources Embedding

The default subjects located in `knowledge_sources/` (moved from the mobile app) will be processed and embedded using `text-embedding-3-small` to provide a base knowledge for the AI.

## 2. Core idea

You do **not** need a special “chunking model.”

The pipeline is:

1. **Extract text** from PDF/DOCX
2. **Clean and structure** the text
3. **Chunk** the text using code-based rules
4. **Embed** each chunk using an embeddings model
5. **Store** the chunk text, metadata, and vector in PostgreSQL
6. When a user asks a question:
   - embed the question
   - search the closest chunks in pgvector
   - send those chunks to Groq
   - return a grounded answer

So the key moving parts are:

- **Groq** → answer generation
- **OpenAI (`text-embedding-3-small`)** → vector creation
- **Postgres + Prisma** → storage and retrieval
- **Hono** → API layer
- **Prisma** → relational data access

---

## 3. Recommended stack

## Backend

- **Hono.js**
- **TypeScript**
- **Node.js**

## Database

- **PostgreSQL**
- **pgvector**
- **Prisma ORM**

## AI / RAG

- **Groq SDK** for generation
- **OpenAI SDK** for `text-embedding-3-small` embeddings
- optional reranking later

## File handling

- PDF text extraction library
- DOCX text extraction library
- object storage for original files

## Auth

- **Hono JWT** (built-in) for full control and lightweight implementation

## Storage

- local disk for development
- S3 / Cloudflare R2 / Supabase Storage in production

---

## 4. Why PostgreSQL + Prisma is a strong fit

Because you already know you will have **user accounts**, PostgreSQL is a smart choice.

It lets you keep:

- users
- courses
- institutions
- uploads
- chunk metadata
- chat history
- subscriptions / plans later
- vector embeddings

all in one main system.

### Benefits

- one primary database for app data
- Prisma gives you clean typed database access
- pgvector allows semantic search without adding a separate vector DB at the start
- easier user-level filtering and permissions

### Tradeoff

A dedicated vector DB like Qdrant can be stronger for very large-scale retrieval, but for **v1**, PostgreSQL + pgvector is a very good, practical choice.

---

## 5. High-level architecture

```text
React Native App
    |
    v
Hono API
    |
    |-- Auth / Users / Sessions
    |-- File Upload Endpoint
    |-- Ingestion Worker / Queue
    |-- Chat Endpoint
    |
    v
PostgreSQL + Prisma + pgvector
    |
    |-- users
    |-- documents
    |-- document_chunks
    |-- chats
    |-- messages
    |
    v
Embeddings Provider
    |
    v
Groq API
```

---

## 6. Main backend responsibilities

Your Hono backend should handle four major responsibilities:

### A. Authentication and user management

- register/login users
- store profile data
- track role: student or lecturer
- associate all uploads and chats to the right user

### B. Document ingestion

- accept uploads
- save file metadata
- extract text
- chunk text
- embed chunks
- store chunks and vectors

### C. Retrieval and chat

- accept user question
- embed the question
- search relevant chunks
- optionally filter by subject/course/user
- send retrieved context to Groq
- return grounded answer

### D. App support services

- chat history
- usage tracking
- rate limiting
- logging
- health checks

---

## 7. Suggested database design

## Users

Store core account and profile information.

Suggested fields:

- id
- email
- password_hash or auth_provider_id
- full_name
- role (`STUDENT` or `LECTURER`)
- institution
- created_at
- updated_at

## Documents

Stores uploaded files.

Suggested fields:

- id
- user_id
- title
- original_filename
- mime_type
- storage_path
- status (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`)
- source_type (`PDF`, `DOCX`)
- subject (optional)
- created_at
- updated_at

## Document Chunks

Stores chunk text and vector data.

Suggested fields:

- id
- document_id
- user_id
- chunk_index
- text
- token_count
- page_start (nullable)
- page_end (nullable)
- heading (nullable)
- embedding (vector column)
- created_at

## Chats

Stores a chat session.

Suggested fields:

- id
- user_id
- title
- created_at
- updated_at

## Messages

Stores chat messages.

Suggested fields:

- id
- chat_id
- role (`USER`, `ASSISTANT`, `SYSTEM`)
- content
- citations_json (nullable)
- created_at

## Optional future tables

- courses
- enrollments
- institutions
- flashcards
- quizzes
- study_plans
- user_preferences

---

## 8. Prisma + pgvector note

Prisma is great for most relational work, but pgvector support can be a little more manual depending on your setup.

Typical pattern:

- use Prisma for normal tables and relations
- use raw SQL where necessary for:
  - enabling `vector` extension
  - creating vector indexes
  - nearest-neighbor similarity search

That is normal and not a problem.

You may end up with:

- **Prisma schema** for app models
- a few **custom SQL migrations** for vector-specific behavior

---

## 9. Document ingestion pipeline

This is the part that prepares your knowledge base.

### Step 1: Upload

User uploads PDF or DOCX from the mobile app.

Backend should:

- validate file type
- validate file size
- save original file
- create a `documents` row with status `UPLOADED`

### Step 2: Extract text

Parse the file and extract text.

For PDF:

- extract page text if possible
- preserve page numbers for citations

For DOCX:

- extract paragraphs and headings
- preserve section structure if possible

### Step 3: Clean text

Do lightweight cleanup:

- normalize line breaks
- remove repeated whitespace
- remove useless headers/footers if possible
- preserve headings where useful

### Step 4: Chunk text

Chunk using code rules, not a special chunking model.

Good starting settings:

- chunk size: **400–800 tokens**
- overlap: **80–150 tokens**

Chunking strategy:

- try to split by headings first
- then paragraphs
- then enforce max chunk size
- keep overlap between adjacent chunks

### Step 5: Embed chunks

Send each chunk text to your embeddings model/provider and get a vector.

### Step 6: Store

Store:

- chunk text
- chunk index
- metadata
- vector embedding

Update document status to `READY`.

---

## 10. Best chunking strategy for v1

Start simple.

### Recommended v1 approach

1. split by headings / section titles if available
2. combine paragraphs into chunks up to target size
3. add overlap
4. attach metadata

### Why this is enough

You do not need advanced semantic chunking at first.
For educational PDFs and notes, clean heading/paragraph chunking works very well.

### Chunk metadata to keep

- document id
- user id
- chunk index
- page number(s)
- heading
- subject
- source filename

This metadata becomes very useful later for:

- filtering
- citations
- debugging retrieval quality

---

## 11. Embeddings choice

Groq is best used as the **generation model**, not your embeddings layer.

So choose one of these for embeddings:

### OpenAI embeddings

Good if you want speed and simplicity.

Example:

- `text-embedding-3-small`

Pros:

- easy to integrate
- strong quality
- beginner-friendly

### Option B: Local embeddings model

Use a sentence-transformer or BGE-style model hosted by you.

Pros:

- more control
- lower long-term variable cost
- better privacy story

Cons:

- more backend complexity
- more memory/ops work

### Recommendation

For **v1**, use a hosted embeddings API so you can focus on shipping.

---

## 12. Retrieval flow

When a user asks a question:

### Step 1

Create embedding for the query.

### Step 2

Search the nearest chunks using pgvector.

### Step 3

Apply filters where needed, for example:

- only this user’s documents
- only a selected subject
- only a selected course

### Step 4

Take the top 5–10 best chunks.

### Step 5

Build a prompt to Groq that includes:

- system instruction
- user question
- retrieved context
- citation metadata

### Step 6

Return:

- answer
- optional citations
- related document references

---

## 13. Prompting strategy for Groq

Your system prompt should be strict and grounded.

Example behavior rules:

- answer only from the provided context
- if context is insufficient, say so clearly
- do not invent facts not present in the retrieved materials
- prefer educational clarity
- cite the document name and page when available
- adapt tone to student/lecturer context if needed

This is important because RAG fails when the model starts confidently improvising beyond the retrieved evidence.

---

## 14. Multi-tenant safety rules

Since users will upload personal or institution-specific materials, enforce strict ownership rules.

Every query should be filtered by:

- `user_id`
- optionally organization/institution if you add shared libraries later

Never allow retrieval across all chunks globally unless the content is intentionally shared.

This matters a lot for privacy and correctness.

---

## 15. File storage design

PostgreSQL should store metadata, not the raw PDF binary itself in most cases.

Recommended:

- store original files in object storage
- store metadata and references in Postgres

### Development

- local `uploads/` folder is okay

### Production

Use one of:

- AWS S3
- Cloudflare R2
- Supabase Storage

Store in DB:

- storage key/path
- original filename
- mime type
- file size

---

## 16. Synchronous vs asynchronous ingestion

Do **not** process large documents fully inside the upload request.

Better design:

### Upload request

- receive file
- save metadata
- enqueue processing job
- return success quickly

### Worker

- extract text
- chunk
- embed
- insert vectors
- mark document as ready

This makes the app feel faster and prevents timeout problems.

### Good tools for queue/workers

- BullMQ + Redis
- Trigger.dev
- simple database job table for very small v1

### Recommendation

For v1:

- if load is tiny, you can process inline temporarily
- but a queue-based worker is the better long-term design

---

## 17. Suggested Hono API routes

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

## Documents

- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id`
- `DELETE /documents/:id`

## Ingestion / status

- `GET /documents/:id/status`

## Chat

- `POST /chat`
- `GET /chats`
- `GET /chats/:id/messages`

## Health/admin

- `GET /health`

---

## 18. Suggested project structure

```text
src/
  index.ts
  app.ts

  config/
    env.ts

  middleware/
    auth.ts
    errorHandler.ts
    rateLimit.ts

  routes/
    auth.ts
    documents.ts
    chat.ts
    health.ts

  services/
    authService.ts
    storageService.ts
    parserService.ts
    chunkingService.ts
    embeddingService.ts
    retrievalService.ts
    groqService.ts
    chatService.ts

  db/
    prisma.ts
    vector.ts

  workers/
    ingestDocument.ts

  lib/
    logger.ts
    tokens.ts
    prompts.ts
    citations.ts

prisma/
  schema.prisma
  migrations/
```

This keeps responsibilities very clear.

---

## 19. Tools and packages to consider

## Core backend

- `hono`
- `@hono/node-server`
- `zod`
- `dotenv`

## Database

- `prisma`
- `@prisma/client`

## Auth

- **Hono JWT** (built-in middleware `hono/jwt`)

## File upload

- **UploadThing** (using custom backend adapters)
- `multer` (for handling multipart data)
- `sharp` (to minify/process file size)

## Parsing

PDF:

- `pdf-parse` or another maintained PDF text extraction library

DOCX:

- `mammoth`

## AI SDKs

- `groq-sdk`

## Queue / jobs

- `bullmq`
- `ioredis`

## Utilities

- `pino` for logging
- `nanoid` or `uuid`
- `tiktoken` or another token estimator if needed

---

## 20. Minimal development phases

## Phase 1: Foundation

Build:

- Hono server
- Prisma setup
- Postgres connection
- user auth
- document upload table
- local file storage

Deliverable:

- user can create account and upload a file

## Phase 2: Ingestion

Build:

- PDF/DOCX extraction
- chunking service
- embedding service
- pgvector storage
- processing status updates

Deliverable:

- uploaded docs become searchable chunks

## Phase 3: Chat with retrieval

Build:

- query embedding
- similarity search
- Groq answer generation
- citation return format

Deliverable:

- user can ask questions about uploaded materials

## Phase 4: Reliability

Add:

- queues/workers
- retries
- logging
- rate limiting
- validation
- better error handling

Deliverable:

- system is stable enough for real testing

## Phase 5: Product polish

Add:

- chat history
- subject filters
- course folders
- shared lecturer materials
- citations in UI
- analytics

---

## 21. Retrieval quality tips

To make the system work well, focus on these:

### Keep chunk sizes reasonable

Too large:

- retrieval becomes noisy

Too small:

- context becomes fragmented

### Preserve metadata

This helps answer:

- where the chunk came from
- how to cite it
- how to filter it

### Use overlap

This prevents important context from being cut off between chunks.

### Return fewer, better chunks

Usually top 5–8 is better than dumping too much context.

### Consider reranking later

If retrieval quality is weak, add a reranker after similarity search.
Not needed for day one.

---

## 22. Common mistakes to avoid

### Mistake 1: storing huge raw documents as one chunk

Bad retrieval quality.

### Mistake 2: using Groq alone without embeddings

You still need embeddings + retrieval for real document Q&A.

### Mistake 3: skipping metadata

You will regret this when debugging and building citations.

### Mistake 4: mixing all users’ chunks together without filtering

This creates privacy and correctness problems.

### Mistake 5: making upload request do all processing synchronously

This will cause timeouts and poor UX.

### Mistake 6: overengineering chunking too early

Simple chunking is enough for v1.

---

## 23. Good v1 design decision for NedAI

Because NedAI is education-focused, structure your data so retrieval can later be filtered by:

- role: student or lecturer
- institution
- subject
- course
- level/class
- document type (textbook, lecture note, exam prep, past question)

Even if you do not expose all of that immediately in the UI, it is smart to make room for it in the data model.

---

## 24. Suggested answer format from backend

Your `/chat` endpoint can return something like:

```json
{
  "answer": "Here is the explanation...",
  "citations": [
    {
      "documentId": "doc_123",
      "documentTitle": "Biology Notes Week 2",
      "page": 4,
      "snippet": "Photosynthesis occurs..."
    }
  ],
  "usedChunks": 5
}
```

That makes it easy for the React Native app to show:

- answer text
- expandable sources
- “from your materials” confidence

---

## 25. My recommended final v1 stack

If I were building your first version, I would choose:

### Backend

- Hono
- TypeScript
- Zod

### Database

- PostgreSQL
- pgvector
- Prisma

### Auth

- Clerk or custom JWT

### Storage

- local dev storage, then Cloudflare R2 or S3

### Parsing

- `pdf-parse`
- `mammoth`

### AI

- Groq for generation
- hosted embeddings API for embeddings

### Background jobs

- BullMQ + Redis

This is lean, realistic, and scalable enough for an MVP.

---

## 26. Best mental model

Think of the system like this:

### PostgreSQL

The memory bank:

- users
- documents
- chunks
- chats
- vectors

### Embeddings model

The translator:

- turns text into numerical meaning

### pgvector

The search layer:

- finds the most semantically relevant chunks

### Groq

The explainer:

- writes the final response from the retrieved evidence

### Hono

The coordinator:

- receives requests
- runs retrieval
- calls Groq
- returns answers

---

## 27. Final recommendation

For your situation, this is a strong path:

- stop fighting heavy local model loading in React Native
- move intelligence to a clean backend
- use **PostgreSQL + Prisma + pgvector**
- use **Groq** for final generation
- use **simple chunking + embeddings** for RAG
- keep the architecture modular so later you can add:
  - shared course libraries
  - lecturer knowledge bases
  - quizzes
  - memory
  - personalized study support

This is absolutely a sensible architecture for NedAI V1.

---

## 28. What to build first

Build in this exact order:

1. Hono app bootstrapped
2. PostgreSQL + Prisma connected
3. user auth
4. file upload endpoint
5. PDF/DOCX text extraction
6. chunking service
7. embeddings service
8. pgvector similarity search
9. Groq answer generation
10. citations + chat history

That order will keep you focused and avoid getting stuck in complexity too early.
