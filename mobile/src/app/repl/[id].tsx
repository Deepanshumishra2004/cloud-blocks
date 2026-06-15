import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReplSocket, type FileNode } from '@/features/app/hooks/use-repl-socket';
import { useReplAgent } from '@/features/app/hooks/use-repl-agent';

// Flatten the tree into a sorted list of file paths for a simple mobile picker.
function flattenFiles(nodes: FileNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.type === 'dir') walk(n.children ?? []);
      else out.push(n.path);
    }
  };
  walk(nodes);
  return out.sort((a, b) => a.localeCompare(b));
}

export default function ReplDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { tree, openPath, content, appStatus, connected, error, openFile } = useReplSocket(id);
  const agent = useReplAgent(id);
  const [prompt, setPrompt] = useState('');

  const files = useMemo(() => flattenFiles(tree), [tree]);

  function submitAi() {
    const p = prompt.trim();
    if (!p || agent.running) return;
    agent.run(p, 'ask');
    setPrompt('');
  }

  return (
    <View className="flex-1 bg-[#030406]" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-12 flex-row items-center gap-3 border-b border-[#1f2937] px-3">
        <Pressable onPress={() => router.back()} className="h-8 w-8 items-center justify-center rounded-md bg-[#0b0d10]">
          <Text className="text-base font-black text-cb-muted">‹</Text>
        </Pressable>
        <Text numberOfLines={1} className="flex-1 text-sm font-black text-cb-primary">
          {openPath ?? 'Select a file'}
        </Text>
        <View className={`rounded-md px-2 py-1 ${connected ? 'bg-success/10' : 'bg-[#0b0d10]'}`}>
          <Text className={`text-[10px] font-black ${connected ? 'text-success' : 'text-cb-muted'}`}>
            {connected ? appStatus : 'connecting…'}
          </Text>
        </View>
      </View>

      {error && (
        <View className="border-b border-danger/25 bg-danger/10 px-3 py-2">
          <Text className="text-[11px] font-bold text-danger">{error}</Text>
        </View>
      )}

      {/* File picker */}
      {files.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 border-b border-[#1f2937]" contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 6 }}>
          {files.map((path) => (
            <Pressable
              key={path}
              onPress={() => openFile(path)}
              className={`rounded-md border px-2.5 py-1 ${path === openPath ? 'border-brand-hover bg-brand/15' : 'border-[#1f2937] bg-[#0b0d10]'}`}
            >
              <Text className={`text-[11px] font-bold ${path === openPath ? 'text-brand' : 'text-cb-muted'}`}>
                {path.split('/').pop()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Read-only code view */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12 }}>
        {!connected && !error ? (
          <View className="items-center py-10"><ActivityIndicator color="#6366f1" /></View>
        ) : openPath ? (
          <Text selectable className="font-mono text-[12px] leading-[18px] text-cb-secondary">
            {content || '// empty file'}
          </Text>
        ) : (
          <Text className="text-xs font-semibold text-cb-muted">
            Pick a file above to view it. Code is read-only on mobile — edit with the AI agent below.
          </Text>
        )}
      </ScrollView>

      {/* Agent question (blocks until answered) */}
      {agent.question && (
        <View className="border-t border-brand/25 bg-brand/10 px-3 py-2">
          <Text className="text-[12px] font-bold text-cb-primary">{agent.question.question}</Text>
          <View className="mt-2 gap-1.5">
            {agent.question.options.map((opt, i) => (
              <Pressable key={i} onPress={() => agent.answer(opt.label)} className="rounded-md border border-[#1f2937] bg-black px-2 py-1.5">
                <Text className="text-[11px] font-black text-cb-primary">{opt.label}</Text>
                {opt.description ? <Text className="text-[10px] text-cb-muted">{opt.description}</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Agent step timeline (read-only) */}
      {(agent.steps.length > 0 || agent.status || agent.todos.length > 0) && (
        <View className="max-h-44 border-t border-[#1f2937] bg-[#08090c]">
          <ScrollView contentContainerStyle={{ padding: 10, gap: 6 }}>
            {agent.todos.length > 0 && (
              <View className="rounded-md border border-[#1f2937] bg-black px-2 py-1.5">
                {agent.todos.map((t, i) => (
                  <Text key={i} className={`text-[10px] ${t.status === 'completed' ? 'text-cb-muted line-through' : t.status === 'in_progress' ? 'text-brand' : 'text-cb-secondary'}`}>
                    {t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'} {t.content}
                  </Text>
                ))}
              </View>
            )}
            {agent.steps.map((step) =>
              step.type === 'text' ? (
                <Text key={step.id} className="text-[11px] leading-4 text-cb-secondary">{step.text}</Text>
              ) : (
                <View key={step.id} className="rounded-md border border-[#1f2937] bg-black px-2 py-1.5">
                  <Text numberOfLines={1} className="text-[11px] font-mono text-cb-primary">
                    {agentToolTitle(step.name, step.input)}
                  </Text>
                  {step.status === 'awaiting' && (
                    <View className="mt-1.5 flex-row gap-2">
                      <Pressable onPress={() => agent.decide(step.id, true)} className="rounded bg-brand/20 px-2 py-1">
                        <Text className="text-[11px] font-black text-brand">Allow</Text>
                      </Pressable>
                      <Pressable onPress={() => agent.decide(step.id, false)} className="rounded bg-[#0b0d10] px-2 py-1">
                        <Text className="text-[11px] font-black text-cb-muted">Deny</Text>
                      </Pressable>
                    </View>
                  )}
                  {step.status === 'done' && step.output && step.name === 'run_command' && (
                    <Text numberOfLines={6} className={`mt-1 text-[10px] font-mono ${step.isError ? 'text-danger' : 'text-cb-muted'}`}>{step.output}</Text>
                  )}
                </View>
              ),
            )}
            {agent.status && <Text className="text-[10px] text-cb-muted">{agent.status}</Text>}
          </ScrollView>
        </View>
      )}

      {/* AI agent prompt bar (the only way to edit on mobile) */}
      <View className="flex-row items-center gap-2 border-t border-[#1f2937] px-3 py-2" style={{ paddingBottom: insets.bottom + 8 }}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask the AI agent to build or change something…"
          placeholderTextColor="#5b6776"
          editable={!agent.running}
          onSubmitEditing={submitAi}
          returnKeyType="send"
          className="h-11 flex-1 rounded-md border border-[#1f2937] bg-black px-3 text-sm font-semibold text-cb-primary"
        />
        {agent.running ? (
          <Pressable onPress={agent.stop} className="h-11 items-center justify-center rounded-md bg-danger/15 px-4">
            <Text className="text-sm font-black text-danger">Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={submitAi}
            disabled={!prompt.trim()}
            className="h-11 items-center justify-center rounded-md border border-brand-hover bg-brand px-4 active:opacity-80"
            style={!prompt.trim() ? { opacity: 0.5 } : undefined}
          >
            <Text className="text-sm font-black text-white">Run</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function agentToolTitle(name: string, input: Record<string, unknown>): string {
  const arg =
    (typeof input.path === 'string' && input.path) ||
    (typeof input.command === 'string' && input.command) ||
    (typeof input.pattern === 'string' && input.pattern) ||
    '';
  return arg ? `${name} ${arg}` : name;
}
