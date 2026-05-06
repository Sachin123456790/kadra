-- Custodial wallet support: encrypted private key column for CUSTODIAL wallets only.
-- Encryption: AES-256-GCM with WALLET_ENCRYPTION_KEY env secret. Format: base64(iv|tag|ciphertext).
ALTER TABLE "wallets" ADD COLUMN "encrypted_private_key" TEXT;
