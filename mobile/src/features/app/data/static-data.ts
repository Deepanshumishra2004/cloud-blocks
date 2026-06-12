import type { AiCredential, Plan, Repl, Subscription, Usage, User } from '../app-types';

export const USER: User = {
  id: 'user_01jzcloudblocks',
  email: 'deepanshu@cloudblocks.dev',
  username: 'deepanshu',
  provider: 'GITHUB',
  avatar: null,
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-12T10:00:00.000Z',
};

export const REPLS: Repl[] = [
  {
    id: 'repl_next_dashboard',
    name: 'next-dashboard',
    type: 'NEXT',
    userId: USER.id,
    status: 'RUNNING',
    createdAt: '2026-06-04T08:20:00.000Z',
    updatedAt: '2026-06-12T09:44:00.000Z',
    lastActive: '12m ago',
  },
  {
    id: 'repl_api_worker',
    name: 'api-worker',
    type: 'BUN',
    userId: USER.id,
    status: 'RUNNING',
    createdAt: '2026-06-02T12:10:00.000Z',
    updatedAt: '2026-06-12T08:05:00.000Z',
    lastActive: '2h ago',
  },
  {
    id: 'repl_react_demo',
    name: 'react-demo',
    type: 'REACT',
    userId: USER.id,
    status: 'STOPPED',
    createdAt: '2026-06-01T14:00:00.000Z',
    updatedAt: '2026-06-10T16:30:00.000Z',
    lastActive: '2d ago',
  },
];

export const PLAN: Plan = {
  id: 'plan_pro_monthly',
  name: 'PRO',
  price: 1900,
  stripePriceId: 'price_cloudblocks_pro_monthly',
  billingCycle: 'MONTHLY',
  maxRepls: 20,
  maxStorageMB: 10240,
  createdAt: '2026-06-01T00:00:00.000Z',
};

export const SUBSCRIPTION: Subscription = {
  id: 'sub_01jzcloudblocks',
  userId: USER.id,
  planId: PLAN.id,
  stripeSubscriptionId: 'sub_static_mobile_preview',
  status: 'ACTIVE',
  currentPeriodStart: '2026-06-01T00:00:00.000Z',
  currentPeriodEnd: '2026-07-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  plan: PLAN,
};

export const USAGE: Usage = {
  repls: { used: 8, max: 20 },
  storage: { usedMb: 2840, maxMb: 10240 },
  compute: { usedHrs: 18, maxHrs: 100 },
};

export const AI_CREDENTIALS: AiCredential[] = [
  {
    id: 'cred_openrouter_main',
    provider: 'OPENROUTER',
    name: 'Main OpenRouter',
    last4: '9A2K',
    maskedKey: '****9A2K',
    isActive: true,
    createdAt: '2026-06-08T12:00:00.000Z',
    updatedAt: '2026-06-12T07:30:00.000Z',
  },
  {
    id: 'cred_gemini_lab',
    provider: 'GEMINI',
    name: 'Gemini Lab',
    last4: '71PQ',
    maskedKey: '****71PQ',
    isActive: false,
    createdAt: '2026-06-05T12:00:00.000Z',
    updatedAt: '2026-06-05T12:00:00.000Z',
  },
];
