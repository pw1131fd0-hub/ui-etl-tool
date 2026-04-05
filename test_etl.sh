#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

PIPELINE_ID="74d6860a-2e2a-4b45-b354-0b290eba99c8"

# Trigger
curl -s -X POST http://localhost:3005/api/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"pipelineId\":\"$PIPELINE_ID\"}"

echo ""
echo "Waiting for ETL..."
sleep 6

# Check result
curl -s "http://localhost:3005/api/pipelines/$PIPELINE_ID/runs" \
  -H "Authorization: Bearer $TOKEN"
