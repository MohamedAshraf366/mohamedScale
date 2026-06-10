-- Clean agent data: keep only the 7 active v2 intents
DELETE FROM agent_actions WHERE status = 'archived';

-- Clear stale confirmation tokens
DELETE FROM agent_confirmations;

-- Clear old test logs
DELETE FROM agent_logs;