import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Account } from './account.entity';
import { Transaction } from './transaction.entity';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // WhatsApp sender id (E.164 digits). Unique link for zero-friction onboarding.
  @Column({ name: 'wa_phone', type: 'varchar', nullable: true })
  waPhone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Account, (account) => account.business)
  accounts: Account[];

  @OneToMany(() => Transaction, (transaction) => transaction.business)
  transactions: Transaction[];
}
