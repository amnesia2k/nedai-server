import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const respond = (
  c: Context,
  status: ContentfulStatusCode = 200,
  message: string,
  data: Record<string, unknown> | unknown[] = {},
) => {
  return c.json(
    {
      success: status >= 200 && status < 300,
      message,
      data,
    },
    status,
  );
};

export default respond;
