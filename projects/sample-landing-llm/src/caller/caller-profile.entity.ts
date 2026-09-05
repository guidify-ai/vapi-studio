import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cross-call caller CRM — keyed by channel + callerId
 * (web cookie UUID or phone ANI). Not a framework table.
 */
@Entity({ name: 'caller_profiles' })
@Unique('uq_caller_profiles_channel_caller', ['channel', 'callerId'])
export class CallerProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  channel!: 'web' | 'phone';

  @Index()
  @Column({ name: 'caller_id', type: 'varchar', length: 128 })
  callerId!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 64, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 64, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  email!: string | null;

  /** SMS / reachability number (ANI or alternate). */
  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  /** Consent to receive a details form (SMS / Studio link). */
  @Column({ name: 'form_send_consent', type: 'boolean', nullable: true })
  formSendConsent!: boolean | null;

  @Column({ name: 'phone_confirmed', type: 'boolean', nullable: true })
  phoneConfirmed!: boolean | null;

  /**
   * Persisted A/B assignment for greeting_v1 (`A` | `B`).
   * Sticky per caller once registered.
   */
  @Column({ name: 'greeting_ab', type: 'varchar', length: 8, nullable: true })
  greetingAb!: string | null;

  /**
   * Extra collected contexts (timeline, slope, last intent, …) —
   * soft bag so intake evolution does not require migrations.
   */
  @Column({ type: 'jsonb', default: {} })
  contexts!: Record<string, unknown>;

  @Column({ name: 'call_count', type: 'int', default: 0 })
  callCount!: number;

  @Column({ name: 'last_conversation_id', type: 'uuid', nullable: true })
  lastConversationId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
