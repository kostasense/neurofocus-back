import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { EncryptedData } from './interfaces/encrypted-data.interface.js';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly nonceLength = 12;
  private readonly authTagLength = 16;

  private readonly key: Buffer;
  private readonly keyVersion: number;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const encodedKey = this.configService.get<string>('DATA_ENCRYPTION_KEY');

    if (!encodedKey) {
      throw new Error(
        'DATA_ENCRYPTION_KEY no está configurada',
      );
    }

    this.key = Buffer.from(encodedKey, 'base64');

    if (this.key.length !== 32) {
      throw new Error(
        'DATA_ENCRYPTION_KEY debe representar exactamente 32 bytes',
      );
    }

    this.keyVersion = Number(
      this.configService.get<string>(
        'DATA_ENCRYPTION_KEY_VERSION',
        '1',
      ),
    );

    if (
      !Number.isInteger(this.keyVersion) ||
      this.keyVersion < 1 ||
      this.keyVersion > 65535
    ) {
      throw new Error(
        'DATA_ENCRYPTION_KEY_VERSION debe ser un entero entre 1 y 65535',
      );
    }
  }

  /**
   * Cifra un dato y devuelve sus componentes por separado.
   *
   * Usar en:
   * - EntradasExpediente
   * - MensajesChat
   */
  encryptDetached(value: string | Buffer): EncryptedData {
    const plaintext = Buffer.isBuffer(value)
      ? value
      : Buffer.from(value, 'utf8');

    const nonce = randomBytes(this.nonceLength);

    const cipher = createCipheriv(
      this.algorithm,
      this.key,
      nonce,
      {
        authTagLength: this.authTagLength,
      },
    );

    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    return {
      ciphertext,
      nonce,
      authTag: cipher.getAuthTag(),
      keyVersion: this.keyVersion,
    };
  }

  /**
   * Descifra datos almacenados en columnas separadas.
   */
  decryptDetached(
    ciphertext: Buffer,
    nonce: Buffer,
    authTag: Buffer,
    keyVersion: number,
  ): Buffer {
    this.validateKeyVersion(keyVersion);

    try {
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        nonce,
        {
          authTagLength: this.authTagLength,
        },
      );

      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch {
      throw new InternalServerErrorException(
        'No fue posible descifrar el contenido',
      );
    }
  }

  /**
   * Versión de decryptDetached que devuelve texto UTF-8.
   */
  decryptDetachedToString(
    ciphertext: Buffer,
    nonce: Buffer,
    authTag: Buffer,
    keyVersion: number,
  ): string {
    return this.decryptDetached(
      ciphertext,
      nonce,
      authTag,
      keyVersion,
    ).toString('utf8');
  }

  /**
   * Empaqueta versión + nonce + etiqueta + ciphertext
   * dentro de un único Buffer.
   *
   * Usar en columnas que solo tienen un VARBINARY:
   * - Pacientes.telefono_cifrado
   * - Pacientes.telefono_confianza_cifrado
   * - AdjuntosExpediente.nombre_archivo_cifrado
   */
  encrypt(value: string | Buffer): Buffer {
    const encrypted = this.encryptDetached(value);

    const versionBuffer = Buffer.allocUnsafe(2);
    versionBuffer.writeUInt16BE(
      encrypted.keyVersion,
      0,
    );

    return Buffer.concat([
      versionBuffer,
      encrypted.nonce,
      encrypted.authTag,
      encrypted.ciphertext,
    ]);
  }

  /**
   * Descifra un Buffer generado por encrypt().
   */
  decrypt(payload: Buffer): string {
    return this.decryptBuffer(payload).toString('utf8');
  }

  /**
   * Descifra y devuelve Buffer para contenido no textual.
   */
  decryptBuffer(payload: Buffer): Buffer {
    const minimumLength =
      2 + this.nonceLength + this.authTagLength;

    if (!payload || payload.length <= minimumLength) {
      throw new InternalServerErrorException(
        'El contenido cifrado no tiene un formato válido',
      );
    }

    const keyVersion = payload.readUInt16BE(0);

    const nonceStart = 2;
    const nonceEnd =
      nonceStart + this.nonceLength;

    const tagEnd =
      nonceEnd + this.authTagLength;

    const nonce = payload.subarray(
      nonceStart,
      nonceEnd,
    );

    const authTag = payload.subarray(
      nonceEnd,
      tagEnd,
    );

    const ciphertext = payload.subarray(tagEnd);

    return this.decryptDetached(
      ciphertext,
      nonce,
      authTag,
      keyVersion,
    );
  }

  isConfigured(): boolean {
    return (
      this.key.length === 32 &&
      this.keyVersion > 0
    );
  }

  getCurrentKeyVersion(): number {
    return this.keyVersion;
  }

  private validateKeyVersion(
    keyVersion: number,
  ): void {
    if (keyVersion !== this.keyVersion) {
      throw new InternalServerErrorException(
        `No existe una clave disponible para la versión ${keyVersion}`,
      );
    }
  }
}