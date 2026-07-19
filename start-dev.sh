#!/usr/bin/env bash
cd /home/z/my-project
export DATABASE_URL="postgresql://postgres.aetpzyhzbidjpewaaejo:GUWGgftCoOKKx5HP@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
export NEXTAUTH_SECRET="yKyYJemMxI2ld+OxUQn8TNIulxgN+fR3JocVBRHtC7w="
exec npx next dev -p 3000
