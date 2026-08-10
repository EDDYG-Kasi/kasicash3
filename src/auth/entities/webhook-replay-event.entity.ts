import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('webhook_replay_events')
export class WebhookReplayEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, unique: true })
  payloadHash: string;

  @Column({ name: 'signature_hash', type: 'varchar', length: 64 })
  signatureHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt: Date;
}
