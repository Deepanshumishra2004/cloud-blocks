import { Router } from "express";
import { PAYMENT, PLAN, REPL, SUBSCRIPTION, USER } from "../config/config";
import userRoutes from "./user.route";
import replRoutes from "./repl.route";
import planRoutes from "./plan.route";
import subscriptionRoutes from "./subscription.route";
import paymentRoutes from "./payment.route";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireActiveSubscription } from "../middleware/activeSubscription";

const apiRoutes = Router();

apiRoutes.use(`${USER}`, userRoutes);
apiRoutes.use(`${REPL}`, authMiddleware, requireActiveSubscription, replRoutes);
apiRoutes.use(`${PLAN}`, planRoutes);
apiRoutes.use(`${SUBSCRIPTION}`,authMiddleware, subscriptionRoutes);
apiRoutes.use(`${PAYMENT}`,authMiddleware, paymentRoutes);

export default apiRoutes;