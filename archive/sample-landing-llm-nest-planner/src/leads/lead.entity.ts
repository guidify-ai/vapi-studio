import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('leads')
export class LeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Anonymous session id from the browser — ties chat turns to one draft. */
  @Column({ type: 'varchar', length: 64 })
  sessionId!: string;

  /** Client IP for daily conversation rate limits (first create only). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  clientIp!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'design' })
  status!: 'design' | 'quoted' | 'completed';

  /** When the conversation was closed (leave / idle / guest exit). */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  /** Why it closed: left_site | idle_timeout | guest_exit | transfer_human (quoted stays status=quoted). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  completedReason!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  company!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Public design draft shown in the UI (no private fields). */
  @Column({ type: 'jsonb', nullable: true })
  designDraft!: Record<string, unknown> | null;

  /** Full chat transcript for follow-up. */
  @Column({ type: 'jsonb', default: [] })
  messages!: Array<{ role: string; content: string }>;

  /** PRIVATE — never expose to the visitor API responses. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  complexity!: string | null;

  /** PRIVATE recommended hours for Guidify quote. */
  @Column({ type: 'int', nullable: true })
  quoteHours!: number | null;

  @Column({ type: 'text', nullable: true })
  quoteRationale!: string | null;

  /** PRIVATE full quote payload (integrations, base/custom hours, …). */
  @Column({ type: 'jsonb', nullable: true })
  privateQuote!: Record<string, unknown> | null;

  /** When we emailed a hot-lead alert (once per session). */
  @Column({ type: 'timestamptz', nullable: true })
  hotLeadNotifiedAt!: Date | null;

  /** When we emailed a Help me build it / quote request. */
  @Column({ type: 'timestamptz', nullable: true })
  quoteNotifiedAt!: Date | null;

  /** Guest questions the planner could not answer — for Guidify quoting follow-up. */
  @Column({ type: 'jsonb', default: [] })
  unansweredQuestions!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
