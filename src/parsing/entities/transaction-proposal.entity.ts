import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transaction_proposals')
@Index(['businessId', 'status', 'createdAt'])
@Index(['businessId', 'sourceWaMessageId'], { unique: true })
export class TransactionProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'source_wa_message_id', type: 'varchar' })
  sourceWaMessageId: string;

  @Column({ name: 'source_payload_hash', type: 'varchar' })
  sourcePayloadHash: string;

  @Column({ type: 'varchar' })
  kind: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'proposal_digest', type: 'varchar', length: 64 })
  proposalDigest: string;

  @Column({ name: 'wa_timestamp', type: 'timestamptz' })
  waTimestamp: Date;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @Column({
    name: 'confirmed_by_wa_message_id',
    type: 'varchar',
    nullable: true,
  })
  confirmedByWaMessageId: string | null;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
