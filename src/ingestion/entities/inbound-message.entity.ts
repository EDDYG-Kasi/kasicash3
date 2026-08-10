import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Raw WhatsApp inbound message store. Every webhook message is persisted here
 * verbatim BEFORE any interpretation (Constitution: traceability — every ledger
 * record must trace back to the original message). Idempotent on wa_message_id
 * because Meta redelivers webhooks on non-200 or timeout.
 */
@Entity('inbound_messages')
export class InboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'wa_message_id', type: 'varchar' })
  waMessageId: string;

  @Column({ name: 'wa_from', type: 'varchar' })
  waFrom: string; // sender phone in WhatsApp wa_id format (E.164 digits)

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string; // resolved during processing

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>; // raw message object as received

  @Column({ name: 'payload_hash', type: 'varchar' })
  payloadHash: string; // sha256 of the raw webhook body

  @Column({ name: 'message_type', type: 'varchar' })
  messageType: string; // text | image | audio | ... (only stored, not interpreted yet)

  @Column({ name: 'text_body', type: 'text', nullable: true })
  textBody: string;

  @Column({ name: 'wa_timestamp', type: 'timestamptz' })
  waTimestamp: Date; // sender-side time (Event Ordering: keep both timestamps)

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date; // server receipt time

  @Column({ type: 'varchar', default: 'RECEIVED' }) // RECEIVED | PROCESSED | FAILED | DEAD
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number; // processing attempts; drives backoff and DLQ cutoff

  @Column({ name: 'ingest_sequence', type: 'bigint', generated: 'increment' })
  ingestSequence: string;

  @Column({ name: 'claim_token', type: 'uuid', nullable: true })
  claimToken: string | null;

  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null; // when a FAILED message is eligible for retry

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode: string | null;
}
