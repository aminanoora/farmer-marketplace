import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: Record<string, any>,
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
  errors?: any[]
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
  model: any,
  query: Record<string, any>,
  options: {
    page?: number;
    limit?: number;
    populate?: any;
    sort?: any;
    select?: string;
  } = {}
) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const [results, total] = await Promise.all([
    model
      .find(query)
      .populate(options.populate)
      .sort(options.sort || "-createdAt")
      .select(options.select)
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
