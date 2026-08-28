import { Request, Response, NextFunction } from "express";
import { validationResult, FieldValidationError } from "express-validator";

/**
 * Middleware to check validation results from express-validator
 */
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: "path" in err ? (err as FieldValidationError).path : undefined,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};
