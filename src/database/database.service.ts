import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sql from 'mssql';

interface ParsedConnectionUrl {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: sql.ConnectionPool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.pool = await this.createConnection();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    if (this.pool) {
      try {
        await this.pool.close();
        this.logger.log('Database connection closed');
      } catch (error) {
        this.logger.error('Error closing database connection:', error);
      }
    }
  }

  // Parsear URL de conexión (mssql://user:pass@host:port/database)
  private parseConnectionUrl(connectionUrl: string): ParsedConnectionUrl {
    try {
      const url = new URL(connectionUrl);

      return {
        server: url.hostname,
        port: parseInt(url.port) || 1433,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
      };
    } catch (error) {
      throw new Error(`Invalid connection URL: ${connectionUrl}`);
    }
  }

  // Crear la conexión única a partir de la URL en el .env
  private async createConnection(): Promise<sql.ConnectionPool> {
    const connectionUrl = this.configService.get<string>('DATABASE_URL');

    if (!connectionUrl) {
      throw new Error('DATABASE_URL no está definida en las variables de entorno');
    }

    const parsedUrl = this.parseConnectionUrl(connectionUrl);

    const poolConfig: sql.config = {
      server: parsedUrl.server,
      port: parsedUrl.port,
      user: parsedUrl.user,
      password: parsedUrl.password,
      database: parsedUrl.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000,
      },
    };

    const pool = new sql.ConnectionPool(poolConfig);
    await pool.connect();

    return pool;
  }

  // Acceso directo al pool, por si se necesita construir queries más complejas
  getPool(): sql.ConnectionPool {
    if (!this.pool || !this.pool.connected) {
      throw new Error('La conexión a la base de datos no está establecida');
    }
    return this.pool;
  }

  // Ejecutar una query con parámetros opcionales
  async executeQuery<T = any>(
    query: string,
    inputs?: { name: string; value: any }[],
  ): Promise<T[]> {
    const request = this.getPool().request();

    if (inputs) {
      inputs.forEach((input) => {
        request.input(input.name, input.value);
      });
    }

    const result = await request.query(query);
    return result.recordset;
  }

  // Verificar si la conexión está activa
  isConnected(): boolean {
    return this.pool?.connected ?? false;
  }

  // Reconectar en caso de que la conexión se haya caído
  async reconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
      } catch (error) {
        this.logger.warn('Error closing previous connection before reconnect:', error);
      }
    }
    this.pool = await this.createConnection();
    this.logger.log('Database reconnected');
  }
}