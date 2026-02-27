import { Router } from "express";
import { signin, signup } from "../controller/user.controller";
import { SIGNIN, SIGNUP } from "../config";

const userRoutes = Router();

userRoutes.post(`${SIGNUP}`, signup);

userRoutes.post(`${SIGNIN}`, signin);

export default userRoutes;