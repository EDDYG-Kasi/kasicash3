import { DataSource } from 'typeorm';
import { buildPostgresDataSourceOptions } from './database-options';

export const AppDataSource = new DataSource(
  buildPostgresDataSourceOptions((name) => process.env[name]),
);

export default AppDataSource;
