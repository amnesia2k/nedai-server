import { Hono } from "hono";
import { logger } from "hono/logger";

import v1App from "@/api/v1/app";
import { errorHandler } from "@/middleware/error-handler";
import { uploadRouter } from "@/uploadthing/router";
import { createRouteHandler } from "uploadthing/server";

const app = new Hono();
const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
});

app.use(logger());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.all("/api/uploadthing", (c) => uploadthingHandler(c.req.raw));
app.route("/api/v1", v1App);

app.onError(errorHandler);

export default app;
