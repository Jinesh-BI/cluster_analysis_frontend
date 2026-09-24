import posthog from "posthog-js";
import { posthogEnabled } from "./posthog";

export const analyticsLogger = {
  info(message, attributes) {
    if (posthogEnabled) posthog.logger.info(message, attributes);
  },
  error(message, attributes) {
    if (posthogEnabled) posthog.logger.error(message, attributes);
  },
};
