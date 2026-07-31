import { body } from "express-validator";

export const productValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 100 })
    .withMessage("Name must be under 100 characters"),
  body("category")
    .notEmpty()
    .withMessage("Category is required"),
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("unit")
    .trim()
    .notEmpty()
    .withMessage("Unit is required (e.g., kg, dozen, piece)"),
  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),
];
