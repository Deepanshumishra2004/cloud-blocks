// src/routes/user.routes.ts
import { Router } from "express";
import {
  changePassword,
  deleteMe,
  githubCallback,
  githubInit,
  googleCallback,
  googleInit,
  me,
  sessionToken,
  signin,
  signout,
  signup,
  updateMe,
} from "../controller/user.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { authLimiter } from "../middleware/rateLimiters";
import { SIGNIN, SIGNUP } from "../config/config";
import {
  activateAiCredential as activateAiCredentialHandler,
  createAiCredential as createAiCredentialHandler,
  deleteAiCredential as deleteAiCredentialHandler,
  listAiCredentials as listAiCredentialsHandler,
} from "../controller/ai.controller";

const userRoutes = Router();

userRoutes.post(SIGNUP, authLimiter, signup);
userRoutes.post(SIGNIN, authLimiter, signin);
userRoutes.post("/signout", signout);
userRoutes.get("/me", authMiddleware, me);
userRoutes.get("/session-token", authMiddleware, sessionToken);
userRoutes.patch("/me", authMiddleware, updateMe);
userRoutes.delete("/me", authMiddleware, deleteMe);
userRoutes.post("/change-password", authMiddleware, changePassword);
userRoutes.get("/ai-credentials", authMiddleware, listAiCredentialsHandler);
userRoutes.post("/ai-credentials", authMiddleware, createAiCredentialHandler);
userRoutes.post("/ai-credentials/activate", authMiddleware, activateAiCredentialHandler);
userRoutes.delete("/ai-credentials/:credentialId", authMiddleware, deleteAiCredentialHandler);

userRoutes.get("/google", authLimiter, googleInit);
userRoutes.get("/google/callback", authLimiter, googleCallback);
userRoutes.get("/github", authLimiter, githubInit);
userRoutes.get("/github/callback", authLimiter, githubCallback);

export default userRoutes;
