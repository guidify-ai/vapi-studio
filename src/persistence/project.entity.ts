import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Durable project identity — public ingress UUID for Vapi URLs
 * (`/{projectUuid}/vapi/...`). Apps seed a stable id for local/dev.
 */
@Entity({ name: 'projects' })
export class ProjectEntity {
  /** Public ingress UUID (path segment). */
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
