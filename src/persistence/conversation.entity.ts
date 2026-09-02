import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ConversationStatus } from '../conversation/types';

@Entity({ name: 'conversations' })
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, default: 'vapi' })
  provider!: string;

  @Index({ unique: true })
  @Column({ name: 'provider_call_id', type: 'varchar', length: 128 })
  providerCallId!: string;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: ConversationStatus;

  /**
   * Stable caller key for cross-call resume (phone ANI or Studio cookie).
   * Refreshed on checkpoint/finalize when the channel learns the id late.
   */
  @Index()
  @Column({
    name: 'caller_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  callerId!: string | null;

  @Column({
    name: 'runtime_instance_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  runtimeInstanceId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  /** Bumped on every checkpoint / finalize — drives the resume window. */
  @Index()
  @Column({
    name: 'last_activity_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastActivityAt!: Date | null;

  /**
   * Latest durable SupervisedConversation snapshot while ACTIVE (crash recovery).
   * Updated after each Supervisor turn. Cleared / superseded by finalState on end.
   */
  @Column({ name: 'runtime_state', type: 'jsonb', nullable: true })
  runtimeState!: Record<string, unknown> | null;

  @Column({ name: 'final_state', type: 'jsonb', nullable: true })
  finalState!: Record<string, unknown> | null;
}
