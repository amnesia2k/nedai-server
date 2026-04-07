To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## Chat configuration

Server-side AI chat uses Groq plus retrieved document chunks.

Set these environment variables in `.env`:

```sh
GROQ_API_KEY=...
GROQ_CHAT_MODEL=openai/gpt-oss-20b
CHAT_RETRIEVAL_TOP_K=5
CHAT_RETRIEVAL_MIN_SCORE=0.2
CHAT_HISTORY_LIMIT=10
```

Chat endpoints:

- `GET /api/v1/chats`
- `GET /api/v1/chats/:chatId/messages`
- `POST /api/v1/chats/messages`
