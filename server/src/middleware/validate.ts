import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      const formatted: Record<string, string> = {};

      Object.entries(fieldErrors).forEach(([key, messages]) => {
        if (messages && messages.length) {
          formatted[key] = messages[0];
        }
      });

      return res.status(400).json({
        error: "Validation failed",
        fields: formatted,
      });
    }
    req.body = parsed.data;
    next();
  };
}
