const PORT = 3000;

const API = "/api/v1";

const USER = "/user";
const SIGNUP = "/signup";
const SIGNIN = "/signin";


const REPL = "/repl";
const CREATE_REPL = "/create";
const DELETE_REPL = "/delete";
const EXISTING_REPL = "/all";
const SINGLE_REPL = "/:replId";

const PLAN = "/plan";
const CREATE_PLAN = "/create";
const DELETE_PLAN = "/delete";
const EXISTING_PLAN = "/all";
const SINGLE_PLAN = "/:planId";

const SUBSCRIPTION = "/subcription";
const USER_SUBSCRIPTION = "/:id";
const DELETE_SUBSCRIPTION = "/delete";
const CREATE_SUBSCRIPTION = "/create";

const PAYMENT = "/payment";
const CREATE_CHECKOUT_SESSION = "/create-checkout-session";

const WEBHOOK = "/webhook";

export {
  PORT,
  API,

  USER,
  SIGNUP,
  SIGNIN,

  REPL,
  CREATE_REPL,
  DELETE_REPL,
  EXISTING_REPL,
  SINGLE_REPL,

  PLAN,
  CREATE_PLAN,
  DELETE_PLAN,
  EXISTING_PLAN,
  SINGLE_PLAN,

  SUBSCRIPTION,
  USER_SUBSCRIPTION,
  DELETE_SUBSCRIPTION,
  CREATE_SUBSCRIPTION,

  PAYMENT,
  CREATE_CHECKOUT_SESSION,

  WEBHOOK
};
