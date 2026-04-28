"use client";
// src/hooks/useRepls.ts
import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import type { Repl, ReplType } from "@/lib/api";

interface UseReplsReturn {
  repls:      Repl[];
  loading:    boolean;
  error:      string | null;
  creating:   boolean;
  refetch:    () => Promise<void>;
  createRepl: (data: { name: string; type: ReplType }) => Promise<Repl>;
  deleteRepl: (id: string) => Promise<void>;
  stopRepl:   (id: string) => Promise<void>;
  startRepl:  (id: string) => Promise<void>;
  renameRepl: (id: string, name: string) => Promise<void>;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string } } } | null)?.response;
  return response?.data?.message ?? fallback;
}

export function useRepls(): UseReplsReturn {
  const [repls,    setRepls]    = useState<Repl[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Track in-flight mutations to avoid state races
  const pendingRef = useRef(new Set<string>());

  const fetchRepls = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get<{ repls: Repl[] }>("/api/v1/repl/all");
      setRepls(data.repls);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load repls"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRepls(); }, [fetchRepls]);

  const createRepl = useCallback(async (payload: { name: string; type: ReplType }) => {
    setCreating(true);
    try {
      const { data } = await api.post<{ repl: Repl }>("/api/v1/repl/create", payload);
      setRepls((prev) => [data.repl, ...prev]);
      return data.repl;
    } finally {
      setCreating(false);
    }
  }, []);

  const deleteRepl = useCallback(async (id: string) => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    // Optimistic remove
    const snapshot = [...repls];
    setRepls((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.delete(`/api/v1/repl/delete/${id}`);
    } catch {
      setRepls(snapshot); // rollback
      throw new Error("Failed to delete repl");
    } finally {
      pendingRef.current.delete(id);
    }
  }, [repls]);

  const stopRepl = useCallback(async (id: string) => {
    setRepls((prev) => prev.map((r) => r.id === id ? { ...r, status: "STOPPED" } : r));
    try {
      await api.post(`/api/v1/repl/${id}/stop`);
    } catch {
      fetchRepls();
    }
  }, [fetchRepls]);

  const startRepl = useCallback(async (id: string) => {
    setRepls((prev) => prev.map((r) => r.id === id ? { ...r, status: "STARTING" } : r));
    try {
      await api.post(`/api/v1/repl/${id}/start`);
      // Poll until backend confirms RUNNING
      const poll = setInterval(async () => {
        const { data } = await api.get<{ repl: Repl }>(`/api/v1/repl/${id}`);
        if (data.repl.status !== "STARTING") {
          setRepls((prev) => prev.map((r) => r.id === id ? data.repl : r));
          clearInterval(poll);
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 30_000); // safety timeout
    } catch (err: unknown) {
      fetchRepls();
      throw new Error(getApiErrorMessage(err, "Failed to start repl"));
    }
  }, [fetchRepls]);

  const renameRepl = useCallback(async (id: string, name: string) => {
    const prev = repls.find((r) => r.id === id)?.name;
    setRepls((p) => p.map((r) => r.id === id ? { ...r, name } : r));
    try {
      await api.patch(`/api/v1/repl/${id}`, { name });
    } catch {
      setRepls((p) => p.map((r) => r.id === id ? { ...r, name: prev ?? r.name } : r));
      throw new Error("Failed to rename repl");
    }
  }, [repls]);

  return {
    repls, loading, error, creating,
    refetch: fetchRepls,
    createRepl, deleteRepl, stopRepl, startRepl, renameRepl,
  };
}
