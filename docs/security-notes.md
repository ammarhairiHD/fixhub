# Security notes

## NFR-10: password storage

The local seed script hashes the shared dummy password with PBKDF2-SHA256, a unique random 16-byte salt per account, and 100,000 iterations. It stores the salt and iteration count alongside the derived hash; it does not store the plaintext password.

This iteration count is for local sample accounts only. Login is not implemented yet, so its CPU cost has not been measured in the Workers runtime. Before implementing authentication, benchmark password verification against the 10 ms Worker CPU budget and tune the production iteration count accordingly.

Seed accounts are synthetic and intended only for local development. Do not reuse their password for real accounts.
