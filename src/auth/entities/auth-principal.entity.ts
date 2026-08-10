import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../../ledger/entities/business.entity';

@Entity('auth_principals')
export class AuthPrincipal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ name: 'email_normalized', type: 'varchar', unique: true })
  emailNormalized: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: string;

  @Column({
    name: 'default_currency',
    type: 'varchar',
    length: 3,
    default: 'ZAR',
  })
  defaultCurrency: string;

  @Column({ type: 'varchar', default: 'Africa/Johannesburg' })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
