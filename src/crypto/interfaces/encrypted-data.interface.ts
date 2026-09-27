export interface EncryptedData {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  keyVersion: number;
}