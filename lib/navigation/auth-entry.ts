export function authResumeUrl(raw: unknown, origin: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.hash ||
      !['/mobile/feed', '/mobile/settings', '/mobile/workspaces', '/mobile/workspaces/hosts'].includes(url.pathname)
    )
      return null;
    const result = new URL(url.pathname, origin);
    const keys = url.pathname === '/mobile/workspaces'
      ? ['workspace', 'session', 'topic', 'agentId', 'source']
      : url.pathname === '/mobile/workspaces/hosts' ? ['source'] : ['topic_id', 'task_id', 'agent_id', 'source'];
    for (const key of keys) {
      const values = url.searchParams.getAll(key);
      if (values.length > 1 || (values[0]?.length || 0) > 128) return null;
      if (values[0]) result.searchParams.set(key, values[0]);
    }
    return result.toString();
  } catch {
    return null;
  }
}
