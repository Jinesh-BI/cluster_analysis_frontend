export const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
export const posthogHost = import.meta.env.VITE_POSTHOG_HOST;
export const posthogEnabled = Boolean(posthogToken && posthogHost);
