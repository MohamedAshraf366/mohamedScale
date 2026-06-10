// n8n Webhook Configuration
// Toggle between test and production webhooks

const IS_PRODUCTION = true; // Change to false for testing

export const N8N_WEBHOOK_URL = IS_PRODUCTION
  ? 'https://samim-studios.app.n8n.cloud/webhook/agent_ingress'
  : 'https://samim-studios.app.n8n.cloud/webhook-test/agent_ingress';

export const N8N_CONFIG = {
  channel: 'lovable',
  lang: 'en',
} as const;
