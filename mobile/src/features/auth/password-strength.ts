export function passwordStrength(password: string) {
  if (!password) return { score: 0, label: '', colorClass: 'bg-cb-border-strong', textClass: 'text-cb-muted' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  const levels = [
    { label: 'Weak', colorClass: 'bg-danger', textClass: 'text-danger' },
    { label: 'Fair', colorClass: 'bg-warning', textClass: 'text-warning' },
    { label: 'Good', colorClass: 'bg-brand', textClass: 'text-brand' },
    { label: 'Strong', colorClass: 'bg-success', textClass: 'text-success' },
  ];

  return { score, ...levels[Math.max(0, Math.min(score - 1, 3))] };
}
