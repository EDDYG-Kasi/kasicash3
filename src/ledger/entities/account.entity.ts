import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Business } from './business.entity';
import { Entry } from './entry.entity';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

@Entity('accounts')
@Unique(['businessId', 'code'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' }) // Store enum as string
  type: string;

  @ManyToOne(() => Business, (business) => business.accounts)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Entry, (entry) => entry.account)
  entries: Entry[];
}
