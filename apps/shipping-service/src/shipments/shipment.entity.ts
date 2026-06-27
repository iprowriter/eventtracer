import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'shipments' })
export class Shipment {
  // PK = the orderId (saga correlationId). One shipment per order, so a
  // redelivered payment.succeeded collides on this key → idempotent (ADR-006),
  // mirroring Payment.orderId.
  @PrimaryColumn('uuid')
  orderId!: string;

  // Our own id for this shipment, minted here; travels in the event payload.
  @Column('uuid')
  shipmentId!: string;

  @Column({ type: 'varchar' })
  carrier!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
