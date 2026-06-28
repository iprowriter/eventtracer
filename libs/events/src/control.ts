/**
 * Control plane for the "kill a consumer" demo (ADR-014).
 *
 * The browser cannot kill a process, so instead it asks the gateway to PAUSE a
 * service's Kafka consumer (and later RESUME it). The gateway publishes a
 * control message on its own topic; the target service pauses consuming its
 * DOMAIN topic only — the control topic keeps flowing, so resume always works.
 *
 * This is NOT part of the saga (rule #2 governs saga calls); it's an operational
 * command, so it lives alongside the other Commands as a contract (rule #7).
 */
export const ControlTopic = 'control.consumer';

/** Services whose consumer can be paused/resumed from the UI (chosen scope). */
export const CONTROLLABLE_SERVICES = [
  'payment-service',
  'shipping-service',
] as const;

export type ControllableService = (typeof CONTROLLABLE_SERVICES)[number];

export type ConsumerControlAction = 'pause' | 'resume';

/** The message the gateway publishes on {@link ControlTopic}. */
export interface ConsumerControlCommand {
  service: ControllableService;
  action: ConsumerControlAction;
}

/** Runtime guard — is this string a service we allow controlling? */
export function isControllableService(s: string): s is ControllableService {
  return (CONTROLLABLE_SERVICES as readonly string[]).includes(s);
}
