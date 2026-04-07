### Backend Coding Style Guide (Hono + TypeScript + Prisma)

This document defines how to implement **routes**, **controllers**, **services**, and **global error handling** in this codebase. It is written so it can be copied directly and given to another AI agent as implementation instructions.

---

## Overall Architecture

- **Stack**: Hono + TypeScript + Prisma.
- **Path Aliases**: Always use `@/` to refer to the `src` directory (configured in `tsconfig.json`).
- **Layers**:
  - **Routes**: Define HTTP endpoints using Hono's router.
  - **Controllers**: Functions that take Hono `Context` (`c`) and return `c.json()` or `c.text()`.
  - **Services**: Contain business logic and data-access orchestration using Prisma.
  - **Middlewares**: Use Hono's built-in middlewares (`hono/jwt`, `hono/logger`, etc.).
- **Responses**:
  - Use `c.json({ success: true, message, data })` for consistent API responses.
- **Async**:
  - Use `async/await` everywhere.
  - Hono handles async errors well, but a custom `errorHandler` middleware is recommended.

---

## Routes

**Location & naming**

- Place route files under `src/api/v1/app/routes/`.
- Use the `domain.feature.route.ts` naming convention.
  - Example: `auth.route.ts` ↔ `auth.controller.ts`.
- Group related endpoints into a single Hono instance.

**Imports & setup**

- Import `Hono` from `hono`.
- Import controllers from `@/api/v1/app/controllers/...`.

**Pattern**

- Always create a Hono instance and export it.

```typescript
import { Hono } from "hono";
import {
  loginUser,
  registerUser,
} from "@/api/v1/app/controllers/auth.controller";
import { jwt } from "hono/jwt";

const auth = new Hono();

// Public routes
auth.post("/login", loginUser);
auth.post("/register", registerUser);

// Authenticated routes (example using built-in JWT)
auth.use("/profile/*", jwt({ secret: process.env.JWT_SECRET! }));
auth.get("/profile", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ user: payload });
});

export default auth;
```

---

## Controllers

**Location & naming**

- Place controller functions in files under `src/api/v1/app/controllers/`.
- Use the `domain.feature.controller.ts` naming convention.

**Responsibilities**

- Accept Hono `Context` (`c`).
- Extract parameters from `c.req` (`json()`, `param()`, `query()`).
- Call the appropriate **service** function.
- Return `c.json()`.
- Do **not**:
  - Access Prisma directly (delegate to services).
  - Contain complex business rules.

**Typical controller pattern**

```typescript
import { Context } from "hono";
import AuthService from "@/api/v1/services/auth.service";

export const loginUser = async (c: Context) => {
  const body = await c.req.json();
  const result = await AuthService.login(body);
  return c.json({
    success: true,
    message: result.message,
    data: result.data,
  });
};
```

---

## Services

**Location & naming**

- Place services under `src/api/v1/services/<name>.service.ts`.
- Use `.service.ts` suffix.

**Responsibilities**

- Own **all business logic** and domain rules.
- Orchestration of Prisma models or external APIs (OpenAI, UploadThing).
- Domain-level validations.
- Do **not** know about Hono `Context`.

**Class + instance pattern**

- Implement services as classes and export a single instance.

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

class AuthServiceImpl {
  public async login(payload: any) {
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Business logic here...

    return {
      message: "Login successful",
      data: user,
    };
  }
}

const AuthService = new AuthServiceImpl();
export default AuthService;
```

---

## Uploads & Processors

**Stack**

- **UploadThing**: For file storage.
- **Multer**: For multipart parsing if using custom adapters.
- **Sharp**: For image processing and minification.

---

## Quick Checklist for New Features

When implementing a new backend feature:

1. **Service**
   - Add/extend a class in `src/api/v1/services/*.service.ts`.
   - Implement business logic and Prisma calls.
2. **Controller**
   - Add `async` controller functions in `src/api/v1/app/controllers/*.controller.ts`.
   - Call the service and return `c.json()`.
3. **Routes**
   - Wire endpoints in `src/api/v1/app/routes/*.route.ts`.
   - Mount the route in the main app at `src/index.ts`.
