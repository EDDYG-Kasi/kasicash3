import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, unique: true })
  payloadHash: string;

  @Column({ name: 'signature_hash', type: 'varchar', length: 64 })
  signatureHash: string;

  @Column({ name: 'raw_body', type: 'bytea' })
  rawBody: Buffer;

  @Column({ type: 'varchar', default: 'RECEIVED' })
  status: string;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
