// src/routes/plan.routes.ts
import { Router } from "express";
import {
  createPlan, deletePlan, getAllPlans, getSinglePlan,
  getUserSubscription, getUserUsage,    // ← ADD these 2 imports
} from "../controller/plan.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { CREATE_PLAN, DELETE_PLAN, EXISTING_PLAN, SINGLE_PLAN } from "../config/config";

const planRoutes = Router();

planRoutes.post(CREATE_PLAN,            createPlan);
planRoutes.post(DELETE_PLAN,            deletePlan);
planRoutes.get( EXISTING_PLAN,          getAllPlans);
planRoutes.get( `${SINGLE_PLAN}/:planId`, getSinglePlan);

// Called by billing page
planRoutes.get("/subscription", authMiddleware, getUserSubscription); // ← ADD
planRoutes.get("/usage",        authMiddleware, getUserUsage);        // ← ADD

export default planRoutes;