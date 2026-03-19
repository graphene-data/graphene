import {KMSClient, EncryptCommand, DecryptCommand} from '@aws-sdk/client-kms'
import crypto from 'node:crypto'

import {PROD} from './consts.ts'

const KMS_KEY_ALIAS = 'alias/graphene-secrets'

let kmsClient: KMSClient | null = null
function getKmsClient(): KMSClient {
  if (!kmsClient) kmsClient = new KMSClient({})
  return kmsClient
}

export async function encryptSecret(plaintext: string): Promise<string> {
  if (!PROD || process.env.ENCRYPTION_SECRET) {
    let key = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_SECRET || 'devsecret')
      .digest()
    let iv = crypto.randomBytes(12)
    let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return 'aes:' + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  }
  let result = await getKmsClient().send(new EncryptCommand({KeyId: KMS_KEY_ALIAS, Plaintext: Buffer.from(plaintext)}))
  if (!result.CiphertextBlob) throw new Error('KMS encryption failed')
  return 'kms:' + Buffer.from(result.CiphertextBlob).toString('base64')
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith('kms:')) {
    if (!PROD) throw new Error('KMS ciphertext can only be decrypted in production')
    let result = await getKmsClient().send(new DecryptCommand({CiphertextBlob: Buffer.from(ciphertext.slice(4), 'base64')}))
    if (!result.Plaintext) throw new Error('KMS decryption failed')
    return Buffer.from(result.Plaintext).toString('utf-8')
  }
  if (ciphertext.startsWith('aes:')) {
    let key = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_SECRET || 'devsecret')
      .digest()
    let data = Buffer.from(ciphertext.slice(4), 'base64')
    let iv = data.subarray(0, 12)
    let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(data.subarray(12, 28))
    return decipher.update(data.subarray(28)) + decipher.final('utf8')
  }
  throw new Error('Unknown ciphertext format')
}
