export type ReplType = 'BUN' | 'JAVASCRIPT' | 'NODE' | 'REACT' | 'NEXT';
export type ReplStatusType = 'RUNNING' | 'STOPPED';
export type PlanName = 'FREE' | 'PRO' | 'TEAMS';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAST_DUE' | 'TRIAL';
export type AiProvider = 'OPENROUTER' | 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';

export type User = {
  id: string;
  email: string;
  username: string;
  provider: 'EMAIL' | 'GOOGLE' | 'GITHUB';
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Repl = {
  id: string;
  name: string;
  type: ReplType;
  userId: string;
  status: ReplStatusType;
  createdAt: string;
  updatedAt: string;
  lastActive: string;
};

export type Plan = {
  id: string;
  name: PlanName;
  price: number;
  stripePriceId: string;
  billingCycle: BillingCycle;
  maxRepls: number;
  maxStorageMB: number;
  createdAt: string;
};

export type Subscription = {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  plan: Plan;
};

export type Usage = {
  repls: { used: number; max: number };
  storage: { usedMb: number; maxMb: number };
  compute: { usedHrs: number; maxHrs: number };
};

export type AiCredential = {
  id: string;
  provider: AiProvider;
  name: string;
  last4: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppSection = 'dashboard' | 'repls' | 'explore' | 'billing' | 'keys' | 'settings';
