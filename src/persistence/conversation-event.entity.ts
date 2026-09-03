import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'conversation_events' })
export class ConversationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  public conversationId!: string;

  @Column({ type: 'varchar', length: 64 })
  public type!: string;

  @Column({ type: 'jsonb', default: {} })
  public payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
