import type { Request, Response } from "express";

const notFoundMiddleWare = (_req: Request, res: Response) => {
    res.status(404).json({message: 'Route not found'})
}


export { notFoundMiddleWare }