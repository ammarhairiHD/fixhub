# Security notes

## NFR-10: password storage

Passwords are hashed with PBKDF2-SHA256, a unique random 16-byte salt per account, and 50,000 iterations. The salt and iteration count are stored alongside the derived hash; plaintext passwords are not stored.

For NFR-10, PBKDF2 was measured in the Cloudflare Workers Vitest runtime using `crypto.subtle.deriveBits`. A single derivation took approximately 3 ms at 50,000 iterations and 7 ms at 100,000 iterations. The production iteration count is set to 50,000 to leave CPU budget for session and database work, and the backend Worker CPU limit is set to 10 ms. The authentication tests, including password changes (which perform two derivations), pass with that configured limit.

Seed accounts are synthetic and intended only for local development. Do not reuse their password for real accounts. Re-running the seed refreshes the sample account hashes to the current iteration count.
