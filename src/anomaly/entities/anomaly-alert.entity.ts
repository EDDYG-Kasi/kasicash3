import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Business } from '../../ledger/entities/business.entity';

@Entity('anomaly_alerts')
@Unique(['businessId', 'anomalyKey'])
export class AnomalyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'anomaly_key', type: 'varchar' })
  anomalyKey: string;

  @Column({ name: 'anomaly_type', type: 'varchar' })
  anomalyType: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar' })
  timezone: string;

  @Column({ name: 'period_start_local', type: 'varchar' })
  periodStartLocal: string;

  @Column({ name: 'period_end_local', type: 'varchar' })
  periodEndLocal: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'SENDING' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_error_code', type: 'varchar', nullable: true })
  lastErrorCode: string | null;

  @Column({ name: 'dispatch_started_at', type: 'timestamptz', nullable: true })
  dispatchStartedAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
