/**
 * Internal webhook configuration
 * 
 * To use a custom webhook URL for this project, set the INTERNAL_WEBHOOK_URL below.
 * To use the default behavior (localStorage + fallback), leave it as undefined.
 * 
 * This configuration has the highest priority and will override any other webhook settings.
 */

// Set your project-specific webhook URL here, or leave undefined for default behavior
export const INTERNAL_WEBHOOK_URL: string | undefined = "https://criadordigital-n8n-webhook.xpr5o6.easypanel.host/webhook/SiteFormulario2";

// Example:
// export const INTERNAL_WEBHOOK_URL = "https://your-webhook-url.com/endpoint";