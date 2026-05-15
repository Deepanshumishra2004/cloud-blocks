// src/routes/user.routes.ts
import { Router } from "express";
import {
  changePassword,
  deleteMe,
  exchangeOAuthCode,
  forgotPassword,
  githubCallback,
  githubInit,
  googleCallback,
  googleInit,
  me,
  refresh,
  resetPassword,
  sessionToken,
  signin,
  signout,
  signup,
  updateMe,
} from "../controller/user.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  authLimiter,
  passwordResetLimiter,
  refreshLimiter,
  sessionTokenLimiter,
} from "../middleware/rateLimiters";
import { SIGNIN, SIGNUP } from "../config/config";
import {
  activateAiCredential as activateAiCredentialHandler,
  createAiCredential as createAiCredentialHandler,
  deleteAiCredential as deleteAiCredentialHandler,
  listAiCredentials as listAiCredentialsHandler,
} from "../controller/ai.controller";

const userRoutes = Router();

// ── Bootstrap / unauthenticated ─────────────────────────────────────────
userRoutes.post(SIGNUP, authLimiter, signup);
userRoutes.post(SIGNIN, authLimiter, signin);
userRoutes.post("/signout", signout);
userRoutes.post("/refresh", refreshLimiter, refresh);

// ── Password recovery ───────────────────────────────────────────────────
userRoutes.post("/forgot-password", passwordResetLimiter, forgotPassword);
userRoutes.post("/reset-password", passwordResetLimiter, resetPassword);

// ── OAuth ───────────────────────────────────────────────────────────────
userRoutes.post("/exchange", authLimiter, exchangeOAuthCode);
userRoutes.get("/google", authLimiter, googleInit);
userRoutes.get("/google/callback", authLimiter, googleCallback);
userRoutes.get("/github", authLimiter, githubInit);
userRoutes.get("/github/callback", authLimiter, githubCallback);

// ── Authenticated ────────────────────────────────────────────────────────
userRoutes.get("/me", authMiddleware, me);
userRoutes.get("/session-token", authMiddleware, sessionTokenLimiter, sessionToken);
userRoutes.patch("/me", authMiddleware, updateMe);
userRoutes.delete("/me", authMiddleware, deleteMe);
userRoutes.post("/change-password", authMiddleware, changePassword);

userRoutes.get("/ai-credentials", authMiddleware, listAiCredentialsHandler);
userRoutes.post("/ai-credentials", authMiddleware, createAiCredentialHandler);
userRoutes.post("/ai-credentials/activate", authMiddleware, activateAiCredentialHandler);
userRoutes.delete("/ai-credentials/:credentialId", authMiddleware, deleteAiCredentialHandler);

export default userRoutes;
