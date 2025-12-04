# Backend Monitoring Service

A comprehensive monitoring solution for REST API applications using industry-standard observability tools.

## Overview

This monitoring service provides real-time insights, metrics collection, log aggregation, and alerting capabilities for backend REST API applications. Built with a modern observability stack, it ensures high availability and performance tracking of your services.

## Technology Stack

- **Metrics & Monitoring**: Prometheus + Grafana
- **Alerting**: Alertmanager
- **Log Aggregation**: Fluentd
- **Backend Framework**: Laravel (PHP)
- **Database**: MySQL
- **Caching**: Redis
- **Web Server**: Nginx
- **Containerization**: Docker
- **Additional Scripts**: Python

## Features

- Real-time metrics collection and visualization
- Custom dashboards for API performance monitoring
- Automated alerting based on configurable thresholds
- Centralized log collection and analysis
- Service health checks and uptime monitoring
- Resource utilization tracking (CPU, Memory, Disk, Network)
- API endpoint performance metrics
- Database query performance monitoring
- Cache hit/miss rate tracking

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   REST API      │────▶│   Prometheus    │────▶│    Grafana      │
│  Application    │     │   (Metrics)     │     │ (Visualization) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │
         │                        ▼
         │              ┌─────────────────┐
         │              │  Alertmanager   │
         │              │   (Alerts)      │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│    Fluentd      │────▶│  Log Storage    │
│ (Log Collector) │     │                 │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- PHP 8.0 or higher
- Composer
- Python 3.8+
- MySQL 8.0
- Redis 6.0+
- Nginx

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd monitoring
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env` file

4. Build and start services using Docker Compose:
```bash
docker-compose up -d
```

5. Initialize the database:
```bash
docker-compose exec app php artisan migrate
```

## Configuration

### Prometheus Configuration

Edit `prometheus/prometheus.yml` to configure scrape targets:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-backend'
    static_configs:
      - targets: ['app:9090']
```

### Grafana Dashboards

Access Grafana at `http://localhost:3000` (default credentials: admin/admin)

1. Add Prometheus as a data source
2. Import pre-configured dashboards from `grafana/dashboards/`

### Alertmanager Rules

Configure alert rules in `prometheus/alerts.yml`:

```yaml
groups:
  - name: api_alerts
    rules:
      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.9"} > 1
        for: 5m
        annotations:
          summary: "High API response time"
```

### Fluentd Configuration

Configure log collection in `fluentd/fluent.conf`:

```
<source>
  @type forward
  port 24224
</source>

<match app.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  logstash_format true
</match>
```

## Usage

### Accessing Services

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **API Application**: http://localhost:8080

### Monitoring Endpoints

The monitoring service exposes the following endpoints:

- `/metrics` - Prometheus metrics endpoint
- `/health` - Health check endpoint
- `/api/status` - Detailed service status

### Custom Metrics

Add custom metrics in your Laravel application:

```php
use Prometheus\CollectorRegistry;

$registry = app(CollectorRegistry::class);
$counter = $registry->getOrRegisterCounter(
    'app',
    'api_requests_total',
    'Total API requests',
    ['endpoint', 'method', 'status']
);
$counter->inc(['endpoint' => '/api/users', 'method' => 'GET', 'status' => '200']);
```

## API Monitoring

### Response Time Tracking

Monitor API endpoint response times:

```python
# scripts/monitor_api.py
import requests
import time
from prometheus_client import Histogram

response_time = Histogram('api_response_time_seconds', 
                         'API response time',
                         ['endpoint'])

def monitor_endpoint(url):
    start = time.time()
    response = requests.get(url)
    duration = time.time() - start
    response_time.labels(endpoint=url).observe(duration)
```

### Error Rate Monitoring

Track API error rates and status codes:

```php
// app/Http/Middleware/MetricsMiddleware.php
public function handle($request, Closure $next)
{
    $response = $next($request);
    
    $this->metrics->incrementCounter('api_requests_total', [
        'method' => $request->method(),
        'endpoint' => $request->path(),
        'status' => $response->status()
    ]);
    
    return $response;
}
```

## Alerts Configuration

### Common Alert Rules

1. **High Error Rate**
   ```yaml
   - alert: HighErrorRate
     expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.05
     for: 5m
   ```

2. **Database Connection Issues**
   ```yaml
   - alert: DatabaseConnectionFailure
     expr: mysql_up == 0
     for: 1m
   ```

3. **Redis Memory Usage**
   ```yaml
   - alert: RedisHighMemoryUsage
     expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
     for: 10m
   ```

## Maintenance

### Log Rotation

Configure log rotation in `/etc/logrotate.d/monitoring`:

```
/var/log/monitoring/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

### Database Maintenance

Schedule regular cleanup of metrics data:

```bash
# Add to crontab
0 2 * * * docker-compose exec app php artisan monitoring:cleanup --days=30
```

## Troubleshooting

### Common Issues

1. **Prometheus not scraping metrics**
   - Check target configuration in `prometheus.yml`
   - Verify metrics endpoint is accessible
   - Check firewall rules

2. **Grafana dashboards showing no data**
   - Verify Prometheus data source configuration
   - Check time range selection
   - Validate PromQL queries

3. **Alerts not firing**
   - Check Alertmanager configuration
   - Verify alert rules syntax
   - Check notification channels

## Performance Optimization

- Use Redis for caching frequently accessed metrics
- Implement data retention policies
- Optimize PromQL queries for better performance
- Use recording rules for complex calculations

## Security

- Enable authentication for all monitoring services
- Use TLS/SSL for all connections
- Implement RBAC for Grafana users
- Secure metrics endpoints with API keys
- Regular security updates for all components

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review logs in `/var/log/monitoring`

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Fluentd Documentation](https://docs.fluentd.org/)
- [Laravel Documentation](https://laravel.com/docs)