#!/bin/bash

# Grafana Dashboard Setup Script
# This script helps configure the project-based filtering

echo "Grafana Dashboard Configuration Helper"
echo "====================================="
echo ""
echo "After importing the dashboard, you need to configure it:"
echo ""
echo "1. Go to Dashboard Settings (gear icon)"
echo "2. Navigate to Variables"
echo "3. Find the 'pod_pattern' variable"
echo "4. Click 'Edit'"
echo "5. In the 'Query' field, add this JavaScript code:"
echo ""
cat << 'EOF'
${project}.replace('all', '.*')
  .replace('dodgeprint-dev', '^dev-dodgeprint-.*|^dev-redis-.*|^mysql-dev-dodgeprint-.*')
  .replace('dodgeprint-stg', '^stg-dodgeprint-.*|^stg-redis-.*|^stg-rabbitmq-.*|^mysql-stg-dodgeprint-.*')
  .replace('dodgeprint', '^dodgeprint-.*|^doks-dodgeprint-.*|^redis-.*|^rabbitmq-.*|^nginx-.*|^prometheus-dodgeprint-.*|^mysql-backup-.*|^mysql-response-backup-.*')
  .replace('shipresolve-dev', '^dev-shipresolve-.*')
  .replace('shipresolve-stg', '^stg-shipresolve-.*')
  .replace('shipresolve', '^shipresolve-.*|^sidccorp-fw-.*')
EOF

echo ""
echo "6. Save the variable"
echo "7. Save the dashboard"
echo ""
echo "The dashboard will now automatically update the pod filter when you change projects!"