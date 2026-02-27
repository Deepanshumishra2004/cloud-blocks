import { Router } from "express";
import { DELETE_SUBSCRIPTION, USER_SUBSCRIPTION } from "../config";
import { getUserSubscription, cancelSubscription } from "../controller/subcription.controller";

const subscriptionRoutes = Router();

subscriptionRoutes.get(`${USER_SUBSCRIPTION}`, getUserSubscription);
subscriptionRoutes.delete(`${DELETE_SUBSCRIPTION}`, cancelSubscription);

export default subscriptionRoutes;