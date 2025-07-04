import crypto from 'crypto';
import { ethers } from 'ethers';

export function generateRandomBytes(size: number = 32): Buffer {
  if (size <= 0 || size > 1024) {
    throw new Error('Size must be between 1 and 1024 bytes');
  }
  return crypto.randomBytes(size);
}

export function generateSecureRandom(size: number = 32): string {
  return generateRandomBytes(size).toString('hex');
}

export function sha256(data: Buffer | string): Buffer {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest();
}

export function sha256Hex(data: Buffer | string): string {
  return sha256(data).toString('hex');
}

export function sha512(data: Buffer | string): Buffer {
  const hash = crypto.createHash('sha512');
  hash.update(data);
  return hash.digest();
}

export function sha512Hex(data: Buffer | string): string {
  return sha512(data).toString('hex');
}

export function hmac256(key: string | Buffer, data: string | Buffer): Buffer {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest();
}

export function hmac256Hex(key: string | Buffer, data: string | Buffer): string {
  return hmac256(key, data).toString('hex');
}

export function toHex(buffer: Buffer): string {
  return '0x' + buffer.toString('hex');
}

export function fromHex(hexString: string): Buffer {
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  if (!/^[a-fA-F0-9]*$/.test(cleanHex)) {
    throw new Error('Invalid hex string');
  }
  return Buffer.from(cleanHex, 'hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateNonce(): string {
  return generateRandomBytes(16).toString('hex');
}

export function encryptAES256(data: string, key: string): { encrypted: string; iv: string } {
  try {
    const iv = generateRandomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

export function decryptAES256(encryptedData: string, key: string, iv: string): string {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || generateRandomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512');
  
  return {
    hash: hash.toString('hex'),
    salt: actualSalt
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const { hash: newHash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(newHash, 'hex'));
  } catch (error) {
    return false;
  }
}

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { publicKey, privateKey };
}

export function signData(data: string, privateKey: string): string {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  } catch (error) {
    throw new Error('Signing failed');
  }
}

export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  } catch (error) {
    return false;
  }
}

export function keccak256(data: string | Buffer): string {
  return ethers.utils.keccak256(data);
}

export function recoverAddress(message: string, signature: string): string {
  try {
    return ethers.utils.verifyMessage(message, signature);
  } catch (error) {
    throw new Error('Failed to recover address from signature');
  }
}

export function isValidSignature(message: string, signature: string, address: string): boolean {
  try {
    const recoveredAddress = recoverAddress(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
}

export function generateWalletFromMnemonic(mnemonic: string, path: string = "m/44'/60'/0'/0/0"): ethers.Wallet {
  try {
    return ethers.Wallet.fromMnemonic(mnemonic, path);
  } catch (error) {
    throw new Error('Failed to generate wallet from mnemonic');
  }
}

export function generateRandomWallet(): ethers.Wallet {
  return ethers.Wallet.createRandom();
}

export function createMessageHash(message: string): string {
  return ethers.utils.hashMessage(message);
}

export function arrayify(value: ethers.utils.BytesLike): Uint8Array {
  return ethers.utils.arrayify(value);
}

export function hexlify(value: ethers.utils.BytesLike): string {
  return ethers.utils.hexlify(value);
}

export function computeAddress(publicKey: string): string {
  try {
    return ethers.utils.computeAddress(publicKey);
  } catch (error) {
    throw new Error('Failed to compute address from public key');
  }
}

export function isValidPrivateKey(privateKey: string): boolean {
  try {
    new ethers.Wallet(privateKey);
    return true;
  } catch (error) {
    return false;
  }
}
