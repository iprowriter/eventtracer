import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type PaymentStatus = 'SUCCEEDED' | 'FAILED';

@Entity({ name: 'payments' })
export class Payment {
  // PK = the orderId (the saga's correlationId). There is exactly one payment
  // attempt per order, so a redelivered order.created collides on this key →
  // idempotent (ADR-006), mirroring how Order.id is used in order-service.
  @PrimaryColumn('uuid')
  orderId!: string;

  // Our own id for this payment, minted here; travels in the event payload.
  @Column('uuid')
  paymentId!: string;

  @Column('numeric', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar' })
  status!: PaymentStatus;

  // Only set when the payment was declined.
  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
