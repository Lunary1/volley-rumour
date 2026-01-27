# Plan: End-to-End Encrypt Messages with Supabase

**TL;DR:** Messages are currently stored as plaintext in the database. We'll implement end-to-end encryption using TweetNaCl.js (a proven crypto library for Supabase) with hybrid encryption: asymmetric key exchange to securely share a symmetric session key between participants, then AES-GCM or XSalsa20-Poly1305 to encrypt messages. This requires adding a crypto dependency, storing encrypted messages with public keys for each user, and updating the message flow to encrypt before insertion and decrypt after retrieval.

## Steps

1. Add `tweetnacl.js` and `nacl-util` dependencies to encrypt/decrypt messages on the client.
2. Create [lib/encryption.ts](lib/encryption.ts) with utilities for key pair generation, encryption, and decryption using NaCl boxes.
3. Add `public_key` and `private_key_encrypted` columns to [schema.sql](schema.sql) messages table to store encrypted private keys per user per conversation.
4. Update [app/actions/messages.ts](app/actions/messages.ts) to accept pre-encrypted content and store the encrypted payload instead of plaintext.
5. Modify [components/chat-interface.tsx](components/chat-interface.tsx) to encrypt messages before sending and decrypt after retrieval (including real-time subscription decryption).
6. Handle key exchange: when a conversation is created or first message sent, agree on shared encryption keys between both users.

## Further Considerations

1. **Key Management Strategy** — Do we derive keys from user passwords (risky, no offline backup) or store encrypted private keys in DB with a master key? Option A: Supabase Vault + master key. Option B: Derive from password + backup codes. Option C: Simpler approach: store public keys in DB, encrypt private key per conversation.

2. **Backward Compatibility** — Should existing plaintext messages remain readable, or require migration? We can support both (check `is_encrypted` flag) or set a cutoff date after which all messages must be encrypted.

3. **Performance Impact** — Encryption/decryption on every message add latency. Should we pre-load user key pairs on login to minimize per-message overhead? Consider caching in React context or localStorage (encrypted).

4. **Search/Filtering** — Encrypted messages can't be searched server-side. Should we allow client-side search only, or store searchable plaintext fields (less secure)? Recommendation: Client-side search in memory.
