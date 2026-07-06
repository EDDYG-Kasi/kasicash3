import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class PostingLifecycle1700000002000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
