# Changelog

All notable changes to `laravel-observatory` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.3] - 2026-01-18

### Fixed
- **Log Bloat** - Fixed large query params causing massive log entries (1000+ items)
  - Added `normalizeArray()` method to limit array depth and item count
  - Default limits: 50 items, 3 levels deep
  - Configurable via `inbound.max_query_items` and `inbound.max_query_depth`

## [1.3.2] - 2026-01-18

### Fixed
- **Redis AUTH Error** - Fixed "ERR AUTH called without password configured" when Redis has no authentication
  - Password now only included in config when explicitly set (non-empty)
  - Prometheus Redis library tried to AUTH when password key existed, even if null

## [1.3.1] - 2026-01-18

### Fixed
- **Docker Build Error** - Fixed "Can't connect to Redis server" during `composer install`
  - PrometheusExporter now uses lazy initialization pattern
  - Storage connection deferred until first metric is recorded
  - Default storage changed from `apcu` to `memory` for safer package discovery
  - Follows same pattern used by Laravel core (RedisServiceProvider, QueueServiceProvider)

### Added
- Tests for disabled Prometheus state
- Test to verify no connection when Prometheus disabled

## [1.3.0] - 2026-01-18

### Added
- **Zero Configuration** - Package works immediately after install with sensible defaults
- **Auto-registered Log Channel** - `observatory` channel automatically configured
  - Writes to `storage/logs/observatory.log`
  - JSON format (Loki/ELK compatible)
  - Daily rotation, 14 days retention
- **Custom Headers Support** - Configurable header extraction for multi-tenant apps
  - Configure via `inbound.custom_headers` option
  - Supports workspace, tenant, correlation IDs, etc.
- **Exporter Config Option** - Added `exporter` config for switching between prometheus/sidmonitor

### Changed
- **Config Structure Simplified** - Merged logger configs into main sections
  - `inbound_logger` → `inbound`
  - `outbound_logger` → `outbound`
  - `job_logger` → `jobs`
  - `exception_logger` → `exceptions`
- **Default Log Channel** - Changed from `daily` to `observatory` (auto-registered)
- **All Loggers Enabled by Default** - No configuration needed to start logging
- **Prometheus Disabled by Default** - Now optional, enable with `OBSERVATORY_PROMETHEUS_ENABLED=true`
- **Improved Grafana Dashboard** - Added Bar Gauge, Gauge panels, better visualizations
- **README Rewritten** - Accurate documentation reflecting current config structure

### Fixed
- Prometheus metrics endpoint removed 'web' middleware (was causing CSRF issues)
- Fixed `auth()` type hints in ExceptionLogger for PHPStan compatibility
- Removed unused `$memoryUsed` parameter in InboundRequestLogger

### Removed
- Hardcoded `X-Workspace-Id` header - Use `custom_headers` config instead
- `service-health-dashboard.json` - Merged into main dashboard

### Breaking Changes
- Config structure changed - Re-publish config if upgrading:
  ```bash
  php artisan vendor:publish --tag=observatory-config --force
  ```
- `X-Workspace-Id` no longer automatically extracted - Add to `custom_headers` if needed

## [1.2.0] - 2026-01-14

### Added
- **Inbound Request Logger** - Log detailed HTTP request/response data to Laravel log channels
- **Outbound Request Logger** - Log external API calls with automatic service detection
- **Job Logger** - Log queue job execution with payload, duration, and memory usage
- **Exception Logger** - Structured exception logging with stack traces and request context
- **Request ID Middleware** - Automatic correlation ID generation and propagation
- **Sensitive Data Masker** - Automatic masking of passwords, tokens, API keys, and PII
- **Service Detection** - Automatically identify external services (Stripe, AWS, Etsy, etc.)
- **Grafana Dashboard Templates** - Pre-built dashboards for Loki data visualization
  - `dashboards/observatory-dashboard.json` - Main overview dashboard
  - `dashboards/service-health-dashboard.json` - External service health dashboard

### Configuration
- New `inbound_logger` config section for HTTP request logging
- New `outbound_logger` config section with service detection patterns
- New `job_logger` config section for queue job logging
- New `exception_logger` config section for exception logging
- New `request_id` config section for correlation ID settings
- Service detection patterns for common services (Stripe, AWS, Shopify, Etsy, etc.)

### Logger Features
- JSON-formatted output optimized for Loki/Grafana
- Configurable log channels per logger type
- Slow request threshold filtering
- Status code filtering (log only errors, etc.)
- Header and body logging with size limits
- Automatic sensitive data masking in all loggers

## [1.1.0] - 2025-12-25

### Added
- Laravel 12.x support

### Changed
- Minimum PHP version is now 8.2 (required by Laravel 12)
- Updated orchestra/testbench to ^10.0 for Laravel 12 testing

## [1.0.0] - 2025-12-25

### Added
- Initial release
- Inbound HTTP request monitoring with automatic middleware
- Outbound HTTP monitoring via Laravel HTTP client integration
- Queue job monitoring with JobProcessing/JobProcessed/JobFailed events
- Exception tracking and counting
- Prometheus metrics export with `/metrics` endpoint
- Support for multiple storage adapters (memory, redis, apc, apcu)
- Custom metrics API (counters, gauges, histograms)
- Configurable path/job/host exclusions
- Basic authentication for metrics endpoint
- SidMonitor exporter stub (coming soon)
- Comprehensive configuration options
- Laravel 10.x and 11.x support
- PHP 8.2+ support

### Prometheus Metrics
- `http_requests_total` - Total HTTP requests counter
- `http_request_duration_seconds` - Request latency histogram
- `http_outbound_requests_total` - Outbound HTTP requests counter
- `http_outbound_duration_seconds` - Outbound latency histogram
- `jobs_processed_total` - Queue jobs counter
- `jobs_duration_seconds` - Job duration histogram
- `exceptions_total` - Exceptions counter
