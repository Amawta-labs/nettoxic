import type { NextFunction, Request, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
