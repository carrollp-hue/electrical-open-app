# Automated encrypted database backup

This workflow backs up the Electrical Open Supabase database every Sunday at 02:17 UTC. It exports the database roles, schema and data, encrypts them, stores a 90-day emergency copy in GitHub Actions, and commits the encrypted file to a separate private repository.

## One-time GitHub setup

1. Create a new **private**, empty GitHub repository, for example `electrical-open-backups`.
2. In the Electrical Open app repository, open **Settings → Secrets and variables → Actions**.
3. Add these **repository secrets**:

   - `SUPABASE_DB_PASSWORD` — the raw database password from Supabase. Do not enter a connection string: the workflow builds the correct, encoded Session pooler connection itself.
   - `BACKUP_PASSPHRASE` — a long unique passphrase. Store it safely in a password manager; it is required to restore a backup.
   - `BACKUP_REPO_TOKEN` — a GitHub fine-grained personal access token with **Contents: Read and write** access to *only* the private backup repository.

4. Add this **repository variable**:

   - `BACKUP_REPOSITORY` — your GitHub owner and private backup repository, for example `carrollp-hue/electrical-open-backups`.

5. Open **Actions → Encrypted Supabase backup → Run workflow** to make the first backup.

## Important

- Never put the database password or the passphrase in a file or a normal Git commit.
- Keep the backup repository private. The backup files are encrypted, but they still contain member data.
- Test a restoration procedure at least once before relying on the backup.
- Supabase Free projects do not include automatic platform backups. This workflow is the external backup copy.

## Restore outline

1. Download an encrypted `.tar.gz.enc` file from the private backup repository.
2. Decrypt it with the saved passphrase:

   ```powershell
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass "pass:YOUR_PASSPHRASE" -in electrical-open-DATE.tar.gz.enc -out backup.tar.gz
   tar -xzf backup.tar.gz
   ```

3. Restore into a replacement Supabase project using the exported roles, schema and data files. Do this only as a planned recovery operation.
