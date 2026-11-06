declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}

export {};
