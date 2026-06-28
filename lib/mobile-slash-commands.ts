import { useEffect, useMemo, useState } from 'react';
import {
  mobileSlashCommandsForAdapter,
  normalizeMobileSlashCommand,
  type MobileSlashCommand,
} from '@wtt/mobile-chat-kit';
import { WTT_API_URL } from '@/lib/api/base-url';

export function useMobileSlashCommands(
  token?: string | null,
  agentId?: string | null,
  adapter?: string | null,
) {
  const [dynamicCommands, setDynamicCommands] = useState<MobileSlashCommand[]>([]);
  const [runtimeAdapter, setRuntimeAdapter] = useState('');

  useEffect(() => {
    if (!token || !agentId) {
      setDynamicCommands([]);
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams();
        if (adapter) params.set('adapter', adapter);
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(
          `${WTT_API_URL}/agents/${encodeURIComponent(agentId || '')}/slash-commands${suffix}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const raw = Array.isArray(data?.commands) ? data.commands : [];
        setDynamicCommands(
          raw
            .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item: Record<string, unknown>) => normalizeMobileSlashCommand(item))
            .filter((item: MobileSlashCommand | null): item is MobileSlashCommand => !!item),
        );
      } catch {
        if (!controller.signal.aborted) setDynamicCommands([]);
      }
    }
    void load();
    return () => controller.abort();
  }, [adapter, agentId, token]);

  useEffect(() => {
    if (adapter) {
      setRuntimeAdapter('');
      return;
    }
    if (!token || !agentId) {
      setRuntimeAdapter('');
      return;
    }
    const controller = new AbortController();
    async function loadAdapter() {
      try {
        const statsPromise = fetch(`${WTT_API_URL}/agents/stats`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null);
        const cloudPromise = fetch(`${WTT_API_URL}/cloud-agents/me?live=false`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null);
        const [stats, cloud] = await Promise.all([statsPromise, cloudPromise]);
        const runtime = stats?.runtimes?.[agentId || ''];
        const runtimeValue = String(
          runtime?.adapter || runtime?.agent_type || runtime?.agentType || '',
        ).trim();
        const cloudValue =
          String(cloud?.agent_id || '') === String(agentId || '')
            ? String(cloud?.agent_type || cloud?.adapter || '').trim()
            : '';
        if (!controller.signal.aborted) setRuntimeAdapter(runtimeValue || cloudValue);
      } catch {
        if (!controller.signal.aborted) setRuntimeAdapter('');
      }
    }
    void loadAdapter();
    return () => controller.abort();
  }, [adapter, agentId, token]);

  return useMemo(
    () => mobileSlashCommandsForAdapter(adapter || runtimeAdapter, dynamicCommands),
    [adapter, dynamicCommands, runtimeAdapter],
  );
}
