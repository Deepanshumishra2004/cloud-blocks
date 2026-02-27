import { Router } from "express";
import { CREATE_PLAN, DELETE_PLAN, EXISTING_PLAN, SINGLE_PLAN } from "../config";

const planRoutes = Router();

planRoutes.post(`${CREATE_PLAN}`);
planRoutes.post(`${DELETE_PLAN}`);
planRoutes.post(`${EXISTING_PLAN}`);
planRoutes.post(`${SINGLE_PLAN}`);

export default planRoutes;