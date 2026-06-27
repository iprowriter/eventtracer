import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventEnvelope } from '@app/events';
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
   * Push the latest consumer-health snapshot to every browser. Separate channel
   * ('status') from the event stream so the UI can render the service bar
   * without it getting tangled in the saga timeline. Still the ONE place
   * anything reaches the UI (rule #3 / ADR-002).
   */
  broadcastStatus(statuses: ConsumerStatus[]) {
    this.server.emit('status', statuses);
  }
}
