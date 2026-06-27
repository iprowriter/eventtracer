import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventEnvelope } from '@app/events';

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
}
