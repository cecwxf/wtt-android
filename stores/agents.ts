import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { WTT_API_URL } from '@/lib/api/base-url';
import { normalizeAndFilterAgents } from '@/lib/agents';

export interface Agent {
  id: string;
  agent_id: string;
  display_name: string;
  is_primary?: boolean;
  api_key?: string;
  invite_code?: string;
}

interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  isLoading: boolean;

  fetchAgents: (token: string) => Promise<void>;
  selectAgent: (agentId: string) => Promise<void>;
  loadSelectedAgent: () => Promise<void>;
  claimAgent: (token: string, agentId: string, inviteCode: string) => Promise<void>;
}

const SELECTED_AGENT_KEY = 'wtt_selected_agent';

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  fetchAgents: async (token: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${WTT_API_URL}/api/users/me/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const agents = normalizeAndFilterAgents(data);
        const previousSelected = get().selectedAgentId;

        set({ agents, isLoading: false });

        if (agents.length === 0) {
          await SecureStore.deleteItemAsync(SELECTED_AGENT_KEY);
          set({ selectedAgentId: null });
          return;
        }

        const stillValid =
          previousSelected && agents.some((agent) => agent.agent_id === previousSelected);

        if (!stillValid) {
          await get().selectAgent(agents[0].agent_id);
        }
      }
    } catch {
      set({ isLoading: false });
    }
  },

  selectAgent: async (agentId: string) => {
    await SecureStore.setItemAsync(SELECTED_AGENT_KEY, agentId);
    set({ selectedAgentId: agentId });
  },

  loadSelectedAgent: async () => {
    const saved = await SecureStore.getItemAsync(SELECTED_AGENT_KEY);
    if (saved) set({ selectedAgentId: saved });
  },

  claimAgent: async (token: string, agentId: string, inviteCode: string) => {
    const res = await fetch(`${WTT_API_URL}/api/agents/${agentId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Claim failed' }));
      throw new Error(err.detail || 'Claim failed');
    }
    await get().fetchAgents(token);
  },
}));
