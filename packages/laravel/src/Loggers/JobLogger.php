<?php

namespace JunixLabs\Observatory\Loggers;

use Illuminate\Contracts\Queue\Job;
use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Support\SensitiveDataMasker;

class JobLogger
{
    protected SensitiveDataMasker $masker;

    protected array $config;

    protected array $jobStartTimes = [];

    protected array $jobStartMemory = [];

    public function __construct(?SensitiveDataMasker $masker = null)
    {
        $this->masker = $masker ?? SensitiveDataMasker::fromConfig();
        $this->config = config('observatory.jobs', []);
    }

    public function isEnabled(): bool
    {
        return config('observatory.enabled', true)
            && config('observatory.jobs.enabled', true);
    }

    /**
     * Start tracking a job
     */
    public function start(Job $job): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $jobId = $this->getJobId($job);
        $this->jobStartTimes[$jobId] = microtime(true);
        $this->jobStartMemory[$jobId] = memory_get_usage(true);
    }

    /**
     * Log job completion
     */
    public function log(Job $job, string $status, ?\Throwable $exception = null): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if (! $this->shouldLog($job, $status)) {
            return;
        }

        $jobId = $this->getJobId($job);
        $startTime = $this->jobStartTimes[$jobId] ?? microtime(true);
        $startMemory = $this->jobStartMemory[$jobId] ?? memory_get_usage(true);

        $duration = (microtime(true) - $startTime) * 1000; // Convert to ms
        $memoryUsed = memory_get_usage(true) - $startMemory;
        $peakMemory = memory_get_peak_usage(true);

        // Clean up tracking arrays
        unset($this->jobStartTimes[$jobId], $this->jobStartMemory[$jobId]);

        $logData = $this->buildLogData($job, $status, $duration, $memoryUsed, $peakMemory, $exception);
        $channel = config('observatory.log_channel', 'observatory');

        if ($status === 'failed' || $exception !== null) {
            Log::channel($channel)->error('JOB_PROCESSED', $logData);
        } else {
            Log::channel($channel)->info('JOB_PROCESSED', $logData);
        }
    }

    /**
     * Check if job should be logged
     */
    protected function shouldLog(Job $job, string $status): bool
    {
        // Check excluded jobs
        $excludeJobs = $this->config['exclude_jobs'] ?? [];
        $jobName = $this->getJobName($job);

        foreach ($excludeJobs as $excludeJob) {
            if ($jobName === $excludeJob || fnmatch($excludeJob, $jobName)) {
                return false;
            }
        }

        // Check status filter
        $onlyStatuses = $this->config['only_statuses'] ?? [];
        if (! empty($onlyStatuses) && ! in_array($status, $onlyStatuses)) {
            return false;
        }

        // Check slow threshold
        $slowThreshold = $this->config['slow_threshold_ms'] ?? 0;
        if ($slowThreshold > 0) {
            $jobId = $this->getJobId($job);
            $startTime = $this->jobStartTimes[$jobId] ?? microtime(true);
            $duration = (microtime(true) - $startTime) * 1000;
            if ($duration < $slowThreshold) {
                return false;
            }
        }

        return true;
    }

    /**
     * Build log data array
     */
    protected function buildLogData(
        Job $job,
        string $status,
        float $duration,
        int $memoryUsed,
        int $peakMemory,
        ?\Throwable $exception = null
    ): array {
        $data = [
            'job_id' => $job->getJobId(),
            'job_name' => $this->getJobName($job),
            'queue' => $job->getQueue(),
            'connection' => $job->getConnectionName(),
            'status' => $status,
            'duration_ms' => round($duration, 2),
            'attempts' => $job->attempts(),
            'max_tries' => $this->getMaxTries($job),
            'timestamp' => now()->toIso8601String(),
        ];

        // Add memory info
        if ($this->config['log_memory'] ?? true) {
            $data['memory'] = [
                'used_mb' => round($memoryUsed / 1024 / 1024, 2),
                'peak_mb' => round($peakMemory / 1024 / 1024, 2),
            ];
        }

        // Add payload if configured
        if ($this->config['log_payload'] ?? false) {
            $data['payload'] = $this->getPayload($job);
        }

        // Add exception info if job failed
        if ($exception !== null) {
            $data['exception'] = [
                'class' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ];

            // Add stack trace if configured
            if ($this->config['log_stack_trace'] ?? false) {
                $data['exception']['trace'] = $this->formatStackTrace($exception);
            }
        }

        // Add environment label
        $data['environment'] = config('observatory.labels.environment', config('app.env'));

        return $data;
    }

    /**
     * Get job ID for tracking
     */
    protected function getJobId(Job $job): string
    {
        return $job->getConnectionName() . ':' . $job->getQueue() . ':' . $job->getJobId();
    }

    /**
     * Get job class name
     */
    protected function getJobName(Job $job): string
    {
        $payload = $job->payload();

        if (isset($payload['displayName'])) {
            return $payload['displayName'];
        }

        if (isset($payload['job'])) {
            return $payload['job'];
        }

        return $job->getName();
    }

    /**
     * Get max tries from job
     */
    protected function getMaxTries(Job $job): ?int
    {
        $payload = $job->payload();

        return $payload['maxTries'] ?? null;
    }

    /**
     * Get masked payload
     */
    protected function getPayload(Job $job): array
    {
        $maxSize = $this->config['max_payload_size'] ?? 64000;
        $payload = $job->payload();

        // Mask sensitive data
        $masked = $this->masker->maskArray($payload);

        // Truncate if too large
        $json = json_encode($masked);
        if (strlen($json) > $maxSize) {
            return ['_truncated' => true, '_size' => strlen($json)];
        }

        return $masked;
    }

    /**
     * Format stack trace
     */
    protected function formatStackTrace(\Throwable $exception): array
    {
        $maxFrames = $this->config['max_stack_frames'] ?? 10;
        $trace = $exception->getTrace();

        return array_slice(array_map(function ($frame) {
            return [
                'file' => $frame['file'] ?? 'unknown',
                'line' => $frame['line'] ?? 0,
                'function' => ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? ''),
            ];
        }, $trace), 0, $maxFrames);
    }

    /**
     * Sanitize label value for Loki
     */
    protected function sanitizeLabel(string $value): string
    {
        // Replace backslashes and special chars for Loki labels
        return preg_replace('/[^a-zA-Z0-9_-]/', '_', $value);
    }
}
