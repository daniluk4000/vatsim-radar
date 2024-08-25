#!/bin/sh

cd /radar
npx prisma generate
npx prisma migrate deploy
rm -rf /tmp/nitro/worker-*
exec node --import=tsx /radar/src/utils/backend/worker/data-worker.ts
