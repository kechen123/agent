INSERT INTO users (id, email, password_hash, name)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'kechen@example.local',
  '$2b$12$a5HcddFquBDddROBLGw84O0jPJy5b5b/3iYbxyrS3.BtTsqT7Pcry',
  'kechen'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    updated_at = now();
