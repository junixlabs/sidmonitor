# Kubernetes Deployment

Deploy Laravel Observatory with Loki stack on Kubernetes.

## Quick Start

```bash
# Add Grafana Helm repo
helm repo add grafana https://grafana.github.io/helm-charts

# Install Loki Stack with Observatory config
helm install loki grafana/loki-stack -n monitoring --create-namespace -f loki-values.yaml

# Or merge with existing values
helm upgrade loki grafana/loki-stack -n monitoring -f your-values.yaml -f loki-values.yaml
```

## Import Dashboard

1. Open Grafana → Dashboards → Import
2. Upload `dashboards/observatory-dashboard.json`
3. Select Loki datasource → Import

## Laravel Pod Configuration

```yaml
metadata:
  annotations:
    observatory.scrape: "true"
    observatory.job: "laravel-observatory"
```

## Files

- `loki-values.yaml` - Promtail scrape config for Observatory
- `laravel-example.yaml` - Example Laravel deployment
