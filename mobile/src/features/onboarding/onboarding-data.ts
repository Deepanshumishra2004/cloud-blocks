import type { ComponentType } from 'react';

import { DashboardPreview } from './previews/dashboard-preview';
import { PreviewRuntimePreview } from './previews/preview-runtime-preview';
import { WorkspacePreview } from './previews/workspace-preview';

export type OnboardingSlide = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  features: string[];
  accentClassName: string;
  Visual: ComponentType;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: 'dashboard',
    eyebrow: 'Projects',
    title: 'Start and manage cloud workspaces',
    description: 'CloudBlocks gives every project a ready cloud environment you can open, monitor, and organize from one place.',
    detail: 'Use mobile to check project health, see running sandboxes, review usage, and jump back to the work that needs attention.',
    features: ['Create repls', 'Track live status', 'Review usage limits'],
    accentClassName: 'text-accent-lime',
    Visual: DashboardPreview,
  },
  {
    key: 'workspace',
    eyebrow: 'Workspace',
    title: 'Editor, files, terminal, and AI together',
    description: 'A coding workspace is more than a file editor. CloudBlocks keeps files, terminal output, previews, and AI help connected.',
    detail: 'Mobile is best for quick edits, reviewing generated code, checking logs, and asking AI for the next change before you return to desktop.',
    features: ['File context', 'Terminal output', 'AI code help'],
    accentClassName: 'text-accent-pink',
    Visual: WorkspacePreview,
  },
  {
    key: 'preview',
    eyebrow: 'Runtime',
    title: 'Run apps in the cloud and preview instantly',
    description: 'Start a sandbox, open a live URL, and confirm that your app is actually running without local setup or dependency installs.',
    detail: 'The mobile app should make status, preview links, and runtime actions easy to reach without pretending to be a full desktop IDE.',
    features: ['Start / stop runtime', 'Open live preview', 'Share cloud URL'],
    accentClassName: 'text-accent-orange',
    Visual: PreviewRuntimePreview,
  },
];
