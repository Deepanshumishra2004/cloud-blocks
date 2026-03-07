// src/routes/user.routes.ts
import { Router } from "express";
import {
  signup, signin, signout, me,
  updateMe, deleteMe, changePassword,   // ← ADD these 3 imports
  googleInit, googleCallback,
  githubInit, githubCallback,
} from "../controller/user.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { SIGNUP, SIGNIN } from "../config/config";

const userRoutes = Router();

userRoutes.post(SIGNUP,      signup);
userRoutes.post(SIGNIN,      signin);
userRoutes.post("/signout",  signout);
userRoutes.get( "/me",       authMiddleware, me);
userRoutes.patch("/me",      authMiddleware, updateMe);         // ← profile update
userRoutes.delete("/me",     authMiddleware, deleteMe);         // ← account delete
userRoutes.post("/change-password", authMiddleware, changePassword); // ← password

userRoutes.get("/google",          googleInit);
userRoutes.get("/google/callback", googleCallback);
userRoutes.get("/github",          githubInit);
userRoutes.get("/github/callback", githubCallback);

export default userRoutes;