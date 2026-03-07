// src/routes/repl.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  createRepl, deleteRepl, getAllRepls,
  getReplById, updateRepl,              // ← ADD updateRepl
  startRepl, stopRepl,                  // ← ADD startRepl, stopRepl
} from "../controller/repl.controller";

const replRoutes = Router();

replRoutes.post(  "/create",        authMiddleware, createRepl);
replRoutes.get(   "/all",           authMiddleware, getAllRepls);
replRoutes.get(   "/:replId",       authMiddleware, getReplById);
replRoutes.patch( "/:replId",       authMiddleware, updateRepl);    // rename
replRoutes.post(  "/:replId/start", authMiddleware, startRepl);     // start
replRoutes.post(  "/:replId/stop",  authMiddleware, stopRepl);      // stop
// ↓ fixed: was /:replId but frontend sends /delete/:id
replRoutes.delete("/delete/:replId", authMiddleware, deleteRepl);

export default replRoutes;