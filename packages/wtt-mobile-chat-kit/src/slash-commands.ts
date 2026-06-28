export type MobileSlashCommandFamily =
  | 'wtt'
  | 'codex'
  | 'claude-code'
  | 'gemini'
  | 'generic'
  | 'skill';

export type MobileSlashCommand = {
  cmd: string;
  desc: string;
  family?: MobileSlashCommandFamily;
  skillId?: string;
  source?: string;
};

export type MobileSlashSendOptions = {
  slashType?: 'agent_passthrough';
  slashCommand?: string;
  commandFamily?: string;
  skillId?: string;
};

const GENERIC_AGENT_COMMANDS: MobileSlashCommand[] = [
  { cmd: '/help', desc: 'Agent · Help', family: 'generic' },
  { cmd: '/status', desc: 'Agent · Runtime status', family: 'generic' },
  { cmd: '/model', desc: 'Agent · Show/switch model', family: 'generic' },
  { cmd: '/new', desc: 'Agent · New session/thread', family: 'generic' },
  { cmd: '/clear', desc: 'Agent · Clear session/thread', family: 'generic' },
  { cmd: '/compact', desc: 'Agent · Compact context', family: 'generic' },
  { cmd: '/upgrade', desc: 'WTT · Upgrade agent toolchain', family: 'wtt' },
];

const CODEX_SLASH_COMMANDS: MobileSlashCommand[] = [
  { cmd: '/agent', desc: 'Codex · Configure/switch agent', family: 'codex' },
  { cmd: '/apps', desc: 'Codex · Browse apps/connectors', family: 'codex' },
  { cmd: '/plugins', desc: 'Codex · Browse/manage plugins', family: 'codex' },
  { cmd: '/hooks', desc: 'Codex · View/manage hooks', family: 'codex' },
  { cmd: '/help', desc: 'Codex · Help', family: 'codex' },
  { cmd: '/status', desc: 'Codex · Session/runtime status', family: 'codex' },
  { cmd: '/model', desc: 'Codex · Show/switch model', family: 'codex' },
  { cmd: '/fast', desc: 'Codex · Toggle/check Fast tier', family: 'codex' },
  { cmd: '/plan', desc: 'Codex · Switch to plan mode', family: 'codex' },
  { cmd: '/goal', desc: 'Codex · Set/view/clear goal', family: 'codex' },
  { cmd: '/personality', desc: 'Codex · Set response style', family: 'codex' },
  { cmd: '/approvals', desc: 'Codex · Approval policy', family: 'codex' },
  { cmd: '/permissions', desc: 'Codex · Approval/sandbox permissions', family: 'codex' },
  { cmd: '/approve', desc: 'Codex · Retry auto-review denial', family: 'codex' },
  { cmd: '/review', desc: 'Codex · Review current changes', family: 'codex' },
  { cmd: '/init', desc: 'Codex · Inspect project and create guidance', family: 'codex' },
  { cmd: '/compact', desc: 'Codex · Compact conversation context', family: 'codex' },
  { cmd: '/clear', desc: 'Codex · Clear current conversation view', family: 'codex' },
  { cmd: '/new', desc: 'Codex · Start a fresh conversation', family: 'codex' },
  { cmd: '/resume', desc: 'Codex · Resume saved conversation', family: 'codex' },
  { cmd: '/fork', desc: 'Codex · Fork current conversation', family: 'codex' },
  { cmd: '/side', desc: 'Codex · Ephemeral side conversation', family: 'codex' },
  { cmd: '/diff', desc: 'Codex · Show pending diff', family: 'codex' },
  { cmd: '/mention', desc: 'Codex · Attach file/folder', family: 'codex' },
  { cmd: '/mcp', desc: 'Codex · List MCP tools', family: 'codex' },
  { cmd: '/memories', desc: 'Codex · Configure memories', family: 'codex' },
  { cmd: '/skills', desc: 'Codex · Browse/use skills', family: 'codex' },
  { cmd: '/ps', desc: 'Codex · Show background terminals', family: 'codex' },
  { cmd: '/stop', desc: 'Codex · Stop background terminals', family: 'codex' },
  { cmd: '/clean', desc: 'Codex · Alias for /stop', family: 'codex' },
  { cmd: '/copy', desc: 'Codex · Copy latest response', family: 'codex' },
  { cmd: '/raw', desc: 'Codex · Toggle raw scrollback', family: 'codex' },
  { cmd: '/debug-config', desc: 'Codex · Config diagnostics', family: 'codex' },
  { cmd: '/statusline', desc: 'Codex · Configure status line', family: 'codex' },
  { cmd: '/title', desc: 'Codex · Configure terminal title', family: 'codex' },
  { cmd: '/theme', desc: 'Codex · Choose theme', family: 'codex' },
  { cmd: '/experimental', desc: 'Codex · Experimental features', family: 'codex' },
  { cmd: '/ide', desc: 'Codex · IDE integration', family: 'codex' },
  { cmd: '/keymap', desc: 'Codex · Keyboard shortcuts', family: 'codex' },
  { cmd: '/vim', desc: 'Codex · Vim mode', family: 'codex' },
  { cmd: '/sandbox-add-read-dir', desc: 'Codex · Add read-only sandbox dir', family: 'codex' },
  { cmd: '/feedback', desc: 'Codex · Send feedback/diagnostics', family: 'codex' },
  { cmd: '/logout', desc: 'Codex · Sign out', family: 'codex' },
  { cmd: '/exit', desc: 'Codex · Exit CLI', family: 'codex' },
  { cmd: '/quit', desc: 'Codex · Exit CLI', family: 'codex' },
];

const CLAUDE_CODE_SLASH_COMMANDS: MobileSlashCommand[] = [
  { cmd: '/add-dir', desc: 'Claude Code · Add working directory', family: 'claude-code' },
  { cmd: '/agents', desc: 'Claude Code · Manage agents', family: 'claude-code' },
  { cmd: '/autofix-pr', desc: 'Claude Code · Auto-fix PR feedback', family: 'claude-code' },
  { cmd: '/background', desc: 'Claude Code · Run in background', family: 'claude-code' },
  { cmd: '/bg', desc: 'Claude Code · Alias for /background', family: 'claude-code' },
  { cmd: '/batch', desc: 'Claude Code · Parallel batch workflow', family: 'claude-code' },
  { cmd: '/branch', desc: 'Claude Code · Branch conversation', family: 'claude-code' },
  { cmd: '/fork', desc: 'Claude Code · Alias for /branch', family: 'claude-code' },
  { cmd: '/btw', desc: 'Claude Code · Side question', family: 'claude-code' },
  { cmd: '/chrome', desc: 'Claude Code · Chrome settings', family: 'claude-code' },
  { cmd: '/claude-api', desc: 'Claude Code · Claude API reference/migration', family: 'claude-code' },
  { cmd: '/help', desc: 'Claude Code · Help', family: 'claude-code' },
  { cmd: '/status', desc: 'Claude Code · Session status', family: 'claude-code' },
  { cmd: '/model', desc: 'Claude Code · Show/switch model', family: 'claude-code' },
  { cmd: '/config', desc: 'Claude Code · Configure runtime', family: 'claude-code' },
  { cmd: '/permissions', desc: 'Claude Code · Manage permissions', family: 'claude-code' },
  { cmd: '/init', desc: 'Claude Code · Create/update CLAUDE.md', family: 'claude-code' },
  { cmd: '/review', desc: 'Claude Code · Review code changes', family: 'claude-code' },
  { cmd: '/code-review', desc: 'Claude Code · Review diff with levels/fix', family: 'claude-code' },
  { cmd: '/security-review', desc: 'Claude Code · Security review', family: 'claude-code' },
  { cmd: '/diff', desc: 'Claude Code · Interactive diff', family: 'claude-code' },
  { cmd: '/context', desc: 'Claude Code · Context usage', family: 'claude-code' },
  { cmd: '/compact', desc: 'Claude Code · Compact context', family: 'claude-code' },
  { cmd: '/clear', desc: 'Claude Code · Clear conversation view', family: 'claude-code' },
  { cmd: '/reset', desc: 'Claude Code · Alias for /clear', family: 'claude-code' },
  { cmd: '/new', desc: 'Claude Code · Alias for /clear', family: 'claude-code' },
  { cmd: '/memory', desc: 'Claude Code · Manage memory files', family: 'claude-code' },
  { cmd: '/mcp', desc: 'Claude Code · Manage MCP', family: 'claude-code' },
  { cmd: '/cost', desc: 'Claude Code · Show usage/cost', family: 'claude-code' },
  { cmd: '/usage', desc: 'Claude Code · Usage/cost stats', family: 'claude-code' },
  { cmd: '/stats', desc: 'Claude Code · Alias for /usage', family: 'claude-code' },
  { cmd: '/effort', desc: 'Claude Code · Reasoning effort', family: 'claude-code' },
  { cmd: '/plan', desc: 'Claude Code · Enter plan mode', family: 'claude-code' },
  { cmd: '/goal', desc: 'Claude Code · Set/view/clear goal', family: 'claude-code' },
  { cmd: '/resume', desc: 'Claude Code · Resume conversation', family: 'claude-code' },
  { cmd: '/continue', desc: 'Claude Code · Alias for /resume', family: 'claude-code' },
  { cmd: '/rewind', desc: 'Claude Code · Rewind checkpoint', family: 'claude-code' },
  { cmd: '/checkpoint', desc: 'Claude Code · Alias for /rewind', family: 'claude-code' },
  { cmd: '/undo', desc: 'Claude Code · Alias for /rewind', family: 'claude-code' },
  { cmd: '/tasks', desc: 'Claude Code · Background tasks', family: 'claude-code' },
  { cmd: '/bashes', desc: 'Claude Code · Alias for /tasks', family: 'claude-code' },
  { cmd: '/run', desc: 'Claude Code · Run/drive app', family: 'claude-code' },
  { cmd: '/verify', desc: 'Claude Code · Verify app change', family: 'claude-code' },
  { cmd: '/simplify', desc: 'Claude Code · Cleanup review', family: 'claude-code' },
  { cmd: '/skills', desc: 'Claude Code · List/manage skills', family: 'claude-code' },
  { cmd: '/reload-skills', desc: 'Claude Code · Reload skills', family: 'claude-code' },
  { cmd: '/plugin', desc: 'Claude Code · Manage plugins', family: 'claude-code' },
  { cmd: '/reload-plugins', desc: 'Claude Code · Reload plugins', family: 'claude-code' },
  { cmd: '/hooks', desc: 'Claude Code · Hooks', family: 'claude-code' },
  { cmd: '/doctor', desc: 'Claude Code · Diagnose install/settings', family: 'claude-code' },
  { cmd: '/debug', desc: 'Claude Code · Debug logging', family: 'claude-code' },
  { cmd: '/export', desc: 'Claude Code · Export conversation', family: 'claude-code' },
  { cmd: '/copy', desc: 'Claude Code · Copy response', family: 'claude-code' },
  { cmd: '/feedback', desc: 'Claude Code · Feedback/bug/share', family: 'claude-code' },
  { cmd: '/bug', desc: 'Claude Code · Alias for /feedback', family: 'claude-code' },
  { cmd: '/share', desc: 'Claude Code · Alias for /feedback', family: 'claude-code' },
  { cmd: '/login', desc: 'Claude Code · Sign in', family: 'claude-code' },
  { cmd: '/logout', desc: 'Claude Code · Sign out', family: 'claude-code' },
  { cmd: '/theme', desc: 'Claude Code · Theme', family: 'claude-code' },
  { cmd: '/statusline', desc: 'Claude Code · Status line', family: 'claude-code' },
  { cmd: '/terminal-setup', desc: 'Claude Code · Terminal keybindings', family: 'claude-code' },
  { cmd: '/tui', desc: 'Claude Code · Terminal UI renderer', family: 'claude-code' },
  { cmd: '/vim', desc: 'Claude Code · Vim mode legacy', family: 'claude-code' },
  { cmd: '/exit', desc: 'Claude Code · Exit/detach', family: 'claude-code' },
  { cmd: '/quit', desc: 'Claude Code · Alias for /exit', family: 'claude-code' },
];

const GEMINI_SLASH_COMMANDS: MobileSlashCommand[] = [
  { cmd: '/about', desc: 'Gemini · Version info', family: 'gemini' },
  { cmd: '/agents', desc: 'Gemini · Manage subagents', family: 'gemini' },
  { cmd: '/auth', desc: 'Gemini · Change auth method', family: 'gemini' },
  { cmd: '/bug', desc: 'Gemini · File issue', family: 'gemini' },
  { cmd: '/chat', desc: 'Gemini · Alias for /resume', family: 'gemini' },
  { cmd: '/clear', desc: 'Gemini · Clear visible history', family: 'gemini' },
  { cmd: '/commands', desc: 'Gemini · Custom commands', family: 'gemini' },
  { cmd: '/compress', desc: 'Gemini · Compress context', family: 'gemini' },
  { cmd: '/copy', desc: 'Gemini · Copy last output', family: 'gemini' },
  { cmd: '/directory', desc: 'Gemini · Workspace directories', family: 'gemini' },
  { cmd: '/dir', desc: 'Gemini · Alias for /directory', family: 'gemini' },
  { cmd: '/docs', desc: 'Gemini · Open docs', family: 'gemini' },
  { cmd: '/editor', desc: 'Gemini · Editor integration', family: 'gemini' },
  { cmd: '/extensions', desc: 'Gemini · Manage extensions', family: 'gemini' },
  { cmd: '/help', desc: 'Gemini · Help', family: 'gemini' },
  { cmd: '/?', desc: 'Gemini · Alias for /help', family: 'gemini' },
  { cmd: '/hooks', desc: 'Gemini · Manage hooks', family: 'gemini' },
  { cmd: '/ide', desc: 'Gemini · IDE integration', family: 'gemini' },
  { cmd: '/init', desc: 'Gemini · Create/update GEMINI.md', family: 'gemini' },
  { cmd: '/mcp', desc: 'Gemini · Manage MCP servers', family: 'gemini' },
  { cmd: '/memory', desc: 'Gemini · Inspect/refresh memory', family: 'gemini' },
  { cmd: '/model', desc: 'Gemini · Model configuration', family: 'gemini' },
  { cmd: '/permissions', desc: 'Gemini · Trust and permissions', family: 'gemini' },
  { cmd: '/plan', desc: 'Gemini · Plan mode', family: 'gemini' },
  { cmd: '/policies', desc: 'Gemini · Active policies', family: 'gemini' },
  { cmd: '/privacy', desc: 'Gemini · Privacy notice', family: 'gemini' },
  { cmd: '/quit', desc: 'Gemini · Exit CLI', family: 'gemini' },
  { cmd: '/exit', desc: 'Gemini · Alias for /quit', family: 'gemini' },
  { cmd: '/restore', desc: 'Gemini · Restore checkpoint', family: 'gemini' },
  { cmd: '/rewind', desc: 'Gemini · Rewind history', family: 'gemini' },
  { cmd: '/resume', desc: 'Gemini · Resume/manage sessions', family: 'gemini' },
  { cmd: '/settings', desc: 'Gemini · Settings editor', family: 'gemini' },
  { cmd: '/shells', desc: 'Gemini · Background shells', family: 'gemini' },
  { cmd: '/bashes', desc: 'Gemini · Alias for /shells', family: 'gemini' },
  { cmd: '/setup-github', desc: 'Gemini · GitHub Actions setup', family: 'gemini' },
  { cmd: '/skills', desc: 'Gemini · Manage skills', family: 'gemini' },
  { cmd: '/stats', desc: 'Gemini · Session stats', family: 'gemini' },
  { cmd: '/terminal-setup', desc: 'Gemini · Multiline keybindings', family: 'gemini' },
  { cmd: '/theme', desc: 'Gemini · Theme', family: 'gemini' },
  { cmd: '/tools', desc: 'Gemini · Available tools', family: 'gemini' },
  { cmd: '/upgrade', desc: 'Gemini · Upgrade Code Assist', family: 'gemini' },
];

function normalizeCommand(raw: string) {
  const cmd = String(raw || '').trim();
  if (!cmd) return '';
  return cmd.startsWith('/') ? cmd : `/${cmd}`;
}

export function normalizeMobileSlashCommand(item: Record<string, unknown>): MobileSlashCommand | null {
  const cmd = normalizeCommand(String(item.cmd || item.command || ''));
  if (!cmd || cmd === '/') return null;
  return {
    cmd,
    desc: String(item.desc || item.description || item.name || 'Agent skill command').trim(),
    family: String(item.family || '').trim() === 'skill' ? 'skill' : 'generic',
    skillId: String(item.skill_id || item.skillId || item.id || '').trim() || undefined,
    source: String(item.source || '').trim() || undefined,
  };
}

export function mobileSlashCommandsForAdapter(
  adapter?: string | null,
  dynamicCommands: MobileSlashCommand[] = [],
) {
  const normalized = String(adapter || '').toLowerCase();
  const runtime = !normalized
    ? [...CODEX_SLASH_COMMANDS, ...CLAUDE_CODE_SLASH_COMMANDS, ...GEMINI_SLASH_COMMANDS]
    : normalized.includes('claude')
    ? CLAUDE_CODE_SLASH_COMMANDS
    : normalized.includes('gemini')
      ? GEMINI_SLASH_COMMANDS
      : normalized.includes('codex')
        ? CODEX_SLASH_COMMANDS
        : GENERIC_AGENT_COMMANDS;
  const map = new Map<string, MobileSlashCommand>();
  for (const command of [...GENERIC_AGENT_COMMANDS, ...runtime, ...dynamicCommands]) {
    const cmd = normalizeCommand(command.cmd);
    if (cmd && !map.has(cmd.toLowerCase())) map.set(cmd.toLowerCase(), { ...command, cmd });
  }
  return Array.from(map.values()).sort((a, b) => a.cmd.localeCompare(b.cmd));
}

export function filterMobileSlashCommands(input: string, commands: MobileSlashCommand[], limit = 8) {
  const value = String(input || '');
  if (!value.startsWith('/') || value.includes('\n')) return [];
  const query = value.trim().toLowerCase();
  return commands
    .filter((command) => command.cmd.toLowerCase().startsWith(query || '/'))
    .slice(0, limit);
}

export function findMobileSlashCommand(input: string, commands: MobileSlashCommand[]) {
  const text = String(input || '').trim();
  if (!text.startsWith('/')) return null;
  const lower = text.toLowerCase();
  return [...commands]
    .sort((a, b) => b.cmd.length - a.cmd.length)
    .find((command) => {
      const cmd = command.cmd.toLowerCase();
      return lower === cmd || lower.startsWith(`${cmd} `);
    }) || null;
}

export function mobileSlashMetadata(
  input: string,
  commands: MobileSlashCommand[] = [],
): MobileSlashSendOptions | undefined {
  const text = String(input || '').trim();
  if (!text.startsWith('/')) return undefined;
  const command = findMobileSlashCommand(text, commands);
  const slashCommand = command?.cmd || text.split(/\s+/, 1)[0] || text;
  return {
    slashType: 'agent_passthrough',
    slashCommand,
    ...(command?.family === 'skill'
      ? { commandFamily: 'skill', skillId: command.skillId || slashCommand.replace(/^\//, '') }
      : {}),
  };
}

export function mobileSlashMetadataPayload(options?: MobileSlashSendOptions) {
  if (!options?.slashType) return undefined;
  return {
    slash_type: options.slashType,
    slash_command: options.slashCommand,
    ...(options.commandFamily ? { command_family: options.commandFamily } : {}),
    ...(options.skillId ? { skill_id: options.skillId } : {}),
  };
}
