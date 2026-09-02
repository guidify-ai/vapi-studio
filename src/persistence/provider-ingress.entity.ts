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
  id!: string;

  @Column({ type: 'varchar', length: 32, default: 'vapi' })
  channel!: string;

  /** webhook | custom-llm */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  kind!: string;

  @Index()
  @Column({ name: 'provider_call_id', type: 'varchar', length: 128, nullable: true })
  providerCallId!: string | null;

  @Index()
  @Column({ name: 'message_type', type: 'varchar', length: 128, nullable: true })
  messageType!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'POST' })
  method!: string;

  @Column({ type: 'varchar', length: 256 })
  path!: string;

  @Column({ type: 'jsonb', default: {} })
  headers!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  body!: Record<string, unknown>;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
