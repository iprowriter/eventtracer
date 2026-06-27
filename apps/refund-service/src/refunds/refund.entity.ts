import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'refunds' })
export class Refund {
  // PK = the orderId (saga correlationId). There is exactly one refund per
  // failed order, so a redelivered payment.failed collides on this key →
  // idempotent (ADR-006), mirroring Payment.orderId / Shipment.orderId.
  @PrimaryColumn('uuid')
  orderId!: string;

  // Our own id for this refund, minted here; travels in the event payload.
  @Column('uuid')
  refundId!: string;

  @Column('numeric', { precision: 12, scale: 2 })
  amount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
