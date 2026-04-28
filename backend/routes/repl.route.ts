import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { aiRateLimit } from "../middleware/aiRateLimit";
import {
  createRepl,
  deleteRepl,
  getAllRepls,
  getReplById,
  startRepl,
  stopRepl,
  updateRepl,
} from "../controller/repl.controller";
import { generateReplCode, streamReplCode } from "../controller/ai.controller";

const replRoutes = Router();

replRoutes.post("/create", authMiddleware, createRepl);
replRoutes.get("/all", authMiddleware, getAllRepls);
replRoutes.get("/:replId", authMiddleware, getReplById);
replRoutes.patch("/:replId", authMiddleware, updateRepl);
replRoutes.post("/:replId/start", authMiddleware, startRepl);
replRoutes.post("/:replId/stop", authMiddleware, stopRepl);
replRoutes.post("/:replId/ai/generate", authMiddleware, aiRateLimit, generateReplCode);
replRoutes.post("/:replId/ai/stream", authMiddleware, aiRateLimit, streamReplCode);
replRoutes.delete("/delete/:replId", authMiddleware, deleteRepl);

export default replRoutes;
