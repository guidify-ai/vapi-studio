import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ConversationStatus } from '../conversation/types';

@Entity({ name: 'conversations' })
@Index('uq_conversations_project_provider_call', ['projectId', 'providerCallId'], {
  unique: true,
})
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  /** Owning project (ingress UUID). */
  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @Column({ type: 'varchar', length: 64, default: 'vapi' })
  public provider!: string;

  @Column({ name: 'provider_call_id', type: 'varchar', length: 128 })
  public providerCallId!: string;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  public status!: ConversationStatus;

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
  public callerId!: string | null;

  @Column({
    name: 'runtime_instance_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  public runtimeInstanceId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  public metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  public endedAt!: Date | null;

  /** Bumped on every checkpoint / finalize — drives the resume window. */
  @Index()
  @Column({
    name: 'last_activity_at',
    type: 'timestamptz',
    nullable: true,
  })
  public lastActivityAt!: Date | null;

  /**
   * Latest durable SupervisedConversation snapshot while ACTIVE (crash recovery).
   * Updated after each Supervisor turn. Cleared / superseded by finalState on end.
   */
  @Column({ name: 'runtime_state', type: 'jsonb', nullable: true })
  public runtimeState!: Record<string, unknown> | null;

  @Column({ name: 'final_state', type: 'jsonb', nullable: true })
  public finalState!: Record<string, unknown> | null;
}
