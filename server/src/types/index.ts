import { Request } from "express";
import { IUser } from "../models/User";

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface ProductQuery extends PaginationQuery {
  category?: string;
  farmer?: string;
  isOrganic?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
}
