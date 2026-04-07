import { Hono } from "hono";
import { logger } from "hono/logger";

import v1App from "@/api/v1/app";
import { errorHandler } from "@/middleware/error-handler";

const app = new Hono();

app.use(logger());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/api/v1", v1App);

app.onError(errorHandler);

export default app;
