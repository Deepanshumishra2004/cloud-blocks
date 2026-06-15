import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { api } from '@/lib/api';
import type { AiCredential } from '../app-types';
import { Button, HeroPanel, ListItem, StatusBadge } from '../ui/primitives';

export function KeysSection() {
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getAiCredentials()
      .then((creds) => { if (!cancelled) setCredentials(creds); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load keys'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="AI providers"
        title="Manage active coding assistants."
        description="Provider keys power the AI agent that edits your repls."
      />
      {loading ? (
        <View className="items-center py-8"><ActivityIndicator color="#6366f1" /></View>
      ) : error ? (
        <Text className="text-xs font-bold text-danger">{error}</Text>
      ) : credentials.length === 0 ? (
        <Text className="text-xs font-semibold text-cb-muted">No AI keys yet. Add one to enable the agent.</Text>
      ) : (
        credentials.map((credential) => (
          <ListItem
            key={credential.id}
            title={credential.name}
            subtitle={`${credential.provider} - ${credential.maskedKey ?? `****${credential.last4}`}`}
            trailing={<StatusBadge active={credential.isActive} label={credential.isActive ? 'Active' : 'Saved'} />}
          />
        ))
      )}
      <Button label="Add AI key (use web app)" />
    </View>
  );
}
