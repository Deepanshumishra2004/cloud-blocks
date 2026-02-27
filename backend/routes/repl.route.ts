import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  createRepl,
  deleteRepl,
  getAllRepls,
  getReplById
} from "../controller/repl.controller";

const replRoutes = Router();

// Create Repl
replRoutes.post("/create", authMiddleware, createRepl);

// Delete Repl
replRoutes.delete("/:replId", authMiddleware, deleteRepl);

// Get All Repls
replRoutes.get("/all", authMiddleware, getAllRepls);

// Get Single Repl
replRoutes.get("/:replId", authMiddleware, getReplById);

export default replRoutes;
