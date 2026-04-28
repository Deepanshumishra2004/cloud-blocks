import { Router } from "express";
import {
  createPlan, deletePlan, getAllPlans, getSinglePlan,
  getUserSubscription, getUserUsage,
} from "../controller/plan.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { adminMiddleware } from "../middleware/adminMiddleware";
import { CREATE_PLAN, DELETE_PLAN, EXISTING_PLAN, SINGLE_PLAN } from "../config/config";

const planRoutes = Router();

planRoutes.post(CREATE_PLAN, authMiddleware, adminMiddleware, createPlan);
planRoutes.post(DELETE_PLAN, authMiddleware, adminMiddleware, deletePlan);
planRoutes.get(EXISTING_PLAN, getAllPlans);
planRoutes.get(SINGLE_PLAN, getSinglePlan);
planRoutes.get("/subscription", authMiddleware, getUserSubscription);
planRoutes.get("/usage",        authMiddleware, getUserUsage);

export default planRoutes;
