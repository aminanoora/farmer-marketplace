import { Response } from "express";
import { Model, Document } from "mongoose";

/**
 * Safely extract an error message from an unknown caught value.
 * Use in catch blocks where the error type is not guaranteed.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

export const sendSuccess = (
  res: Response,
  data: Record<string, unknown>,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    ...data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: string[]
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

/**
 * Paginate a query and return formatted results
 */
export const paginateResults = async (
  model: Model<Document>,
  query: Record<string, unknown>,
  options: {
    page?: number;
    limit?: number;
    populate?: string | { path: string; select?: string };
    sort?: string | Record<string, 1 | -1>;
    select?: string;
  } = {}
) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const [results, total] = await Promise.all([
    model
      .find(query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .populate(options.populate as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort(options.sort as any)
      .select(options.select as string)
      .skip(skip)
      .limit(limit),
    model.countDocuments(query),
  ]);

  return {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};
