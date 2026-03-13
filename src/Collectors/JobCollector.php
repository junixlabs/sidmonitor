<?php

namespace JunixLabs\Observatory\Collectors;

use Illuminate\Contracts\Queue\Job;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Loggers\JobLogger;

class JobCollector
{
    protected ExporterInterface $exporter;

    protected JobLogger $logger;

    protected array $jobStartTimes = [];

    public function __construct(ExporterInterface $exporter, JobLogger $logger)
    {
        $this->exporter = $exporter;
        $this->logger = $logger;
    }

    public function start(Job $job): void
    {
        $jobId = $this->getJobId($job);
        $this->jobStartTimes[$jobId] = microtime(true);

        // Start logger tracking
        $this->logger->start($job);
    }

    public function end(Job $job, string $status, ?\Throwable $exception = null): void
    {
        $jobId = $this->getJobId($job);
        $startTime = $this->jobStartTimes[$jobId] ?? microtime(true);
        $duration = microtime(true) - $startTime;

        unset($this->jobStartTimes[$jobId]);

        $data = [
            'job_id' => $job->getJobId(),
            'job_name' => $this->getJobName($job),
            'queue' => $job->getQueue(),
            'connection' => $job->getConnectionName(),
            'status' => $status,
            'duration' => $duration,
            'attempts' => $job->attempts(),
            'timestamp' => now()->toIso8601String(),
        ];

        // Add payload if configured
        if (config('observatory.jobs.record_payload', false)) {
            $maxSize = config('observatory.jobs.max_payload_size', 64000);
            $payload = json_encode($job->payload());
            $data['payload'] = strlen($payload) > $maxSize ? substr($payload, 0, $maxSize) : $payload;
        }

        // Add exception info if job failed
        if ($exception !== null) {
            $data['exception'] = [
                'class' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ];
        }

        // Add custom labels
        $data['labels'] = config('observatory.labels', []);

        // Record metrics
        $this->exporter->recordJob($data);

        // Log to channel
        $this->logger->log($job, $status, $exception);

        // Also record exception if present
        if ($exception !== null && config('observatory.exceptions.enabled', true)) {
            if (! $this->shouldIgnoreException($exception)) {
                $this->exporter->recordException($exception, [
                    'job_name' => $data['job_name'],
                    'queue' => $data['queue'],
                ]);
            }
        }
    }

    public function shouldMonitor(Job $job): bool
    {
        $excludeJobs = config('observatory.jobs.exclude_jobs', []);
        $jobName = $this->getJobName($job);

        foreach ($excludeJobs as $excludeJob) {
            if ($jobName === $excludeJob || fnmatch($excludeJob, $jobName)) {
                return false;
            }
        }

        return true;
    }

    protected function getJobId(Job $job): string
    {
        return $job->getConnectionName() . ':' . $job->getQueue() . ':' . $job->getJobId();
    }

    protected function getJobName(Job $job): string
    {
        $payload = $job->payload();

        // Try to get the actual job class name
        if (isset($payload['displayName'])) {
            return $payload['displayName'];
        }

        if (isset($payload['job'])) {
            return $payload['job'];
        }

        return $job->getName();
    }

    protected function shouldIgnoreException(\Throwable $exception): bool
    {
        $ignoreExceptions = config('observatory.exceptions.ignore', []);

        foreach ($ignoreExceptions as $ignoreClass) {
            if ($exception instanceof $ignoreClass) {
                return true;
            }
        }

        return false;
    }
}
