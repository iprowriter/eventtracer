import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { type DeadLetter, EventEnvelope, dlq } from '@app/events';
import type { ConsumerStatus } from './consumer-lag.service';

@WebSocketGateway({
  // dev only — the browser page connects from another origin. socket.io has its
  // OWN cors, separate from app.enableCors() above.
  cors: { origin: '*' },
})
export class EventMonitorGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventMonitorGateway.name);

  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`UI connected: ${client.id}`);
  }

  /**
   * Push one event to every connected browser. This is the ONE place anything
   * pushes to the UI (rule #3 / ADR-002). The browser groups by correlationId.
   */
  broadcast(envelope: EventEnvelope) {
    this.server.emit('event', envelope);
  }

  /**
   * Re-push a historical envelope during a replay. Same 'event' channel so it
   * lands in its saga column, but flagged `replayed: true` so the UI can mark it
   * and a replay doesn't masquerade as fresh live traffic. Still the ONE place
   * anything reaches the UI (rule #3 / ADR-002).
   */
  broadcastReplay(envelope: EventEnvelope) {
    this.server.emit('event', { ...envelope, replayed: true });
  }

  /**
   * Push the latest consumer-health snapshot to every browser. Separate channel
   * ('status') from the event stream so the UI can render the service bar
   * without it getting tangled in the saga timeline. Still the ONE place
   * anything reaches the UI (rule #3 / ADR-002).
   */
  broadcastStatus(statuses: ConsumerStatus[]) {
    this.server.emit('status', statuses);
  }

  /**
   * Reshape a dead letter into an envelope-like card and push it on the SAME
   * 'event' channel, so it lands in its run's saga column flagged as a `.DLQ`
   * event (the UI styles it red). eventType is the DLQ topic name (a plain
   * string, not a Topics value) — that's why we build the object here rather
   * than pass an EventEnvelope.
   */
  broadcastDeadLetter(deadLetter: DeadLetter) {
    const { original } = deadLetter;
    this.server.emit('event', {
      eventId: original.eventId,
      eventType: dlq(deadLetter.originalTopic),
      occurredAt: deadLetter.failedAt,
      correlationId: original.correlationId,
      version: original.version,
      payload: {
        error: deadLetter.error,
        attempts: deadLetter.attempts,
        originalTopic: deadLetter.originalTopic,
        originalPayload: original.payload,
      },
    });
  }
}
