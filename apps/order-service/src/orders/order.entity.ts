import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type OrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'SHIPPED'
  | 'REFUNDED';

@Entity({ name: 'orders' })
export class Order {
  // Minted by the GATEWAY (it's the saga correlationId), so we set it ourselves
  // — NOT a @PrimaryGeneratedColumn. Using it as the PK makes redelivery safe:
  // a duplicate command collides on the key (ADR-006).
  @PrimaryColumn('uuid')
  id!: string;

  @Column('jsonb')
  items!: { sku: string; quantity: number }[];

  @Column('numeric', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: 'CREATED' })
  status!: OrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
