import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'provider_ingress' })
export class ProviderIngressEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  /** Owning project (ingress UUID); null for legacy/unscoped writes. */
  @Index()
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  public projectId!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'vapi' })
  public channel!: string;

  /** webhook | custom-llm */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  public kind!: string;

  @Index()
  @Column({ name: 'provider_call_id', type: 'varchar', length: 128, nullable: true })
  public providerCallId!: string | null;

  @Index()
  @Column({ name: 'message_type', type: 'varchar', length: 128, nullable: true })
  public messageType!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'POST' })
  public method!: string;

  @Column({ type: 'varchar', length: 256 })
  public path!: string;

  @Column({ type: 'jsonb', default: {} })
  public headers!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  public body!: Record<string, unknown>;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  public responseStatus!: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  public responseBody!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
