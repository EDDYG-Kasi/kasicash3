import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { Account } from './account.entity';

@Entity('entries')
export class Entry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor: string; // BigInt mapped to string by TypeORM

  @Column({ type: 'varchar' }) // DEBIT, CREDIT
  type: string;

  // Denormalised tenant key. Enforced by composite FKs so an entry can only
  // reference a transaction and an account that belong to this same business.
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.entries)
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @ManyToOne(() => Account, (account) => account.entries)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
