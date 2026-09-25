import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Durable project identity for DB FKs (conversations, ingress).
 * Public Vapi routes are host-scoped (`/vapi/...`) on each app fork — `id` is not a URL segment.
 */
@Entity({ name: 'projects' })
export class ProjectEntity {
  /** Internal UUID primary key (not used in public paths). */
  @PrimaryColumn({ type: 'uuid' })
  public id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  public slug!: string;

  @Column({ type: 'varchar', length: 128 })
  public name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
