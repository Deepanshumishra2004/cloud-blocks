// ── Server ───────────────────────────────────────────────────
export const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// ── API prefix ───────────────────────────────────────────────
export const API = "/api/v1";

// ── User / Auth ──────────────────────────────────────────────
export const USER    = "/user";
export const SIGNUP  = "/signup";
export const SIGNIN  = "/signin";

// ── Repl ─────────────────────────────────────────────────────
export const REPL          = "/repl";
export const CREATE_REPL   = "/create";
export const DELETE_REPL   = "/delete";
export const EXISTING_REPL = "/all";
export const SINGLE_REPL   = "/:replId";

// ── Plan ─────────────────────────────────────────────────────
export const PLAN          = "/plan";
export const CREATE_PLAN   = "/create";
export const DELETE_PLAN   = "/delete";
export const EXISTING_PLAN = "/all";
export const SINGLE_PLAN   = "/:planId";

// ── Subscription ─────────────────────────────────────────────
export const SUBSCRIPTION        = "/subscription";
export const USER_SUBSCRIPTION   = "/:id";
export const CREATE_SUBSCRIPTION = "/create";
export const DELETE_SUBSCRIPTION = "/delete";

// ── Payment ──────────────────────────────────────────────────
export const PAYMENT                 = "/payment";
export const CREATE_CHECKOUT_SESSION = "/create-checkout-session";
export const WEBHOOK                 = "/webhook";