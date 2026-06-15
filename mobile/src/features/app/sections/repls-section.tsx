import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { ReplType } from '../app-types';
import { ReplCard } from '../components/repl-card';
import { useRepls } from '../hooks/use-repls';
import { api } from '@/lib/api';
import { Card, HeroPanel, SectionHeader } from '../ui/primitives';

const TEMPLATES: { label: ReplType; description: string }[] = [
  { label: 'NEXT', description: 'Full stack app' },
  { label: 'REACT', description: 'Frontend UI' },
  { label: 'BUN', description: 'Fast runtime' },
];

export function ReplsSection() {
  const { repls, loading, error, reload, create } = useRepls();
  const [creating, setCreating] = useState<ReplType | null>(null);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCreate(type: ReplType) {
    const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleaned) { setActionError('Enter a repl name (lowercase, a-z, 0-9, -).'); return; }
    setActionError(null);
    try {
      await create(cleaned, type);
      setName('');
      setCreating(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create repl');
    }
  }

  async function handleToggle(id: string, isRunning: boolean) {
    setBusyId(id);
    setActionError(null);
    try {
      if (isRunning) await api.stopRepl(id);
      else await api.startRepl(id);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Projects"
        title="Create, run, and inspect repls."
        description="Tap a repl to open its files, terminal output, and AI agent."
      />

      <View className="flex-row gap-3">
        {TEMPLATES.map((t) => (
          <Pressable key={t.label} className="flex-1" onPress={() => setCreating(t.label)}>
            <Card className="flex-1">
              <Text className="text-sm font-black text-accent-pink">{t.label}</Text>
              <Text className="mt-1 text-[11px] font-semibold leading-4 text-cb-muted">{t.description}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      {creating && (
        <Card>
          <Text className="text-xs font-black text-cb-primary">New {creating} repl</Text>
          <TextInput
            value={name}
            onChangeText={(v) => setName(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="my-repl-name"
            placeholderTextColor="#5b6776"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-2 h-11 rounded-md border border-[#1f2937] bg-black px-3 text-sm font-bold text-cb-primary"
          />
          <View className="mt-3 flex-row gap-2">
            <Pressable className="flex-1 h-10 items-center justify-center rounded-md border border-brand-hover bg-brand active:opacity-80" onPress={() => handleCreate(creating)}>
              <Text className="text-sm font-black text-white">Create</Text>
            </Pressable>
            <Pressable className="flex-1 h-10 items-center justify-center rounded-md border border-[#1f2937] bg-[#0b0d10]" onPress={() => { setCreating(null); setName(''); setActionError(null); }}>
              <Text className="text-sm font-black text-cb-muted">Cancel</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {actionError && <Text className="text-xs font-bold text-danger">{actionError}</Text>}

      <SectionHeader title="Projects" action="Refresh" onPress={reload} />

      {loading ? (
        <View className="items-center py-8"><ActivityIndicator color="#6366f1" /></View>
      ) : error ? (
        <Text className="text-xs font-bold text-danger">{error}</Text>
      ) : repls.length === 0 ? (
        <Text className="text-xs font-semibold text-cb-muted">No repls yet. Pick a template above to create one.</Text>
      ) : (
        <View className="gap-3">
          {repls.map((repl) => (
            <ReplCard
              key={repl.id}
              repl={repl}
              detailed
              busy={busyId === repl.id}
              onToggle={() => handleToggle(repl.id, repl.status === 'RUNNING')}
            />
          ))}
        </View>
      )}
    </View>
  );
}
