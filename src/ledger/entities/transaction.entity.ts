import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
  Index,
} from 'typeorm';
import { Business } from './business.entity';
import { Entry } from './entry.entity';

@Entity('transactions')
@Unique(['businessId', 'idempotencyKey'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Index()
  @Column({ name: 'idempotency_key', type: 'varchar' })
  idempotencyKey: string;

  @Column({ name: 'source_type', type: 'varchar' }) // WHATSAPP, WEB, API
  sourceType: string;

  @Index()
  @Column({ name: 'source_message_id', nullable: true, type: 'varchar' })
  sourceMessageId: string;

  @Column({ name: 'source_payload_hash', nullable: true, type: 'varchar' })
  sourcePayloadHash: string;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @Column({
    name: 'posted_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  postedAt: Date;

  @Column({ type: 'varchar', default: 'POSTED' }) // POSTED, REVERSED
  status: string;

  @Index()
  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'reversal_of_transaction_id' })
  reversalOfTransaction: Transaction;

  @Column({ name: 'reversal_of_transaction_id', nullable: true, type: 'uuid' })
  reversalOfTransactionId: string;

  @ManyToOne(() => Business, (business) => business.transactions)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Entry, (entry) => entry.transaction)
  entries: Entry[];
}
