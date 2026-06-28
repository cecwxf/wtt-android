import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/storage/secure-store';
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
  hydrateAgents: (raw: unknown) => Promise<void>;
  selectAgent: (agentId: string) => Promise<void>;
  loadSelectedAgent: () => Promise<void>;
}

const SELECTED_AGENT_KEY = 'wtt_selected_agent';

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  fetchAgents: async (token: string) => {
    set({ isLoading: true });
    try {
      const endpoints = [`${WTT_API_URL}/agents/my`];
      let data: unknown = null;
      let ok = false;

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            data = await res.json();
            ok = true;
            break;
          }
        } catch {
          // try next endpoint
        }
      }

      if (!ok) {
        set({ agents: [], selectedAgentId: null, isLoading: false });
        await deleteSecureItem(SELECTED_AGENT_KEY);
        return;
      }

      await get().hydrateAgents(data);
    } catch {
      set({ isLoading: false });
    }
  },

  hydrateAgents: async (raw: unknown) => {
    const agents = normalizeAndFilterAgents(raw);
    const previousSelected = get().selectedAgentId;
    set({ agents, isLoading: false });

    if (agents.length === 0) {
      await deleteSecureItem(SELECTED_AGENT_KEY);
      set({ selectedAgentId: null });
      return;
    }

    const stillValid = previousSelected && agents.some((agent) => agent.agent_id === previousSelected);
    if (!stillValid) {
      await get().selectAgent(agents[0].agent_id);
    }
  },

  selectAgent: async (agentId: string) => {
    await setSecureItem(SELECTED_AGENT_KEY, agentId);
    set({ selectedAgentId: agentId });
  },

  loadSelectedAgent: async () => {
    const saved = await getSecureItem(SELECTED_AGENT_KEY);
    if (saved) set({ selectedAgentId: saved });
  },
}));
