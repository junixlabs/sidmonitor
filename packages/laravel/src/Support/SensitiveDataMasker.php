<?php

namespace JunixLabs\Observatory\Support;

class SensitiveDataMasker
{
    protected array $maskFields;

    protected string $maskReplacement;

    protected array $excludeHeaders;

    public function __construct(
        array $maskFields = [],
        string $maskReplacement = '********',
        array $excludeHeaders = []
    ) {
        $this->maskFields = array_map('strtolower', $maskFields);
        $this->maskReplacement = $maskReplacement;
        $this->excludeHeaders = array_map('strtolower', $excludeHeaders);
    }

    /**
     * Create instance from config
     */
    public static function fromConfig(): self
    {
        return new self(
            config('observatory.inbound_logger.mask_fields', []),
            config('observatory.inbound_logger.mask_replacement', '********'),
            config('observatory.inbound_logger.exclude_headers', [])
        );
    }

    /**
     * Mask sensitive data in an array (request body, etc.)
     */
    public function maskArray(array $data): array
    {
        return $this->recursiveMask($data);
    }

    /**
     * Mask sensitive data in a JSON string
     */
    public function maskJson(string $json): string
    {
        $data = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return $json;
        }

        return json_encode($this->maskArray($data), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Filter headers, removing sensitive ones
     */
    public function filterHeaders(array $headers): array
    {
        $filtered = [];

        foreach ($headers as $key => $value) {
            $lowerKey = strtolower($key);

            if (in_array($lowerKey, $this->excludeHeaders)) {
                $filtered[$key] = $this->maskReplacement;
            } else {
                $filtered[$key] = is_array($value) ? implode(', ', $value) : $value;
            }
        }

        return $filtered;
    }

    /**
     * Mask query string parameters
     */
    public function maskQueryString(string $queryString): string
    {
        if (empty($queryString)) {
            return $queryString;
        }

        parse_str($queryString, $params);
        $masked = $this->maskArray($params);

        return http_build_query($masked);
    }

    /**
     * Recursively mask sensitive fields in array
     */
    protected function recursiveMask(array $data, string $parentKey = ''): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            $currentPath = $parentKey ? "{$parentKey}.{$key}" : $key;
            $lowerKey = strtolower($key);

            if ($this->shouldMask($lowerKey, $currentPath)) {
                $result[$key] = $this->maskReplacement;
            } elseif (is_array($value)) {
                $result[$key] = $this->recursiveMask($value, $currentPath);
            } else {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * Check if a field should be masked
     */
    protected function shouldMask(string $key, string $path): bool
    {
        $lowerKey = strtolower($key);
        $lowerPath = strtolower($path);

        foreach ($this->maskFields as $field) {
            // Exact match on key
            if ($lowerKey === $field) {
                return true;
            }

            // Match on full path (for dot notation)
            if ($lowerPath === $field) {
                return true;
            }

            // Wildcard match (e.g., "*.password" matches "user.password")
            if (str_contains($field, '*')) {
                $pattern = str_replace('*', '.*', $field);
                if (preg_match("/^{$pattern}$/i", $lowerPath)) {
                    return true;
                }
            }

            // Partial match for common patterns
            if (str_contains($lowerKey, $field) || str_contains($field, $lowerKey)) {
                // Only if it's a sensitive keyword
                $sensitiveKeywords = ['password', 'secret', 'token', 'key', 'credit', 'cvv', 'ssn'];
                foreach ($sensitiveKeywords as $keyword) {
                    if (str_contains($lowerKey, $keyword)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Truncate content to max size
     */
    public function truncate(string $content, int $maxSize): string
    {
        if (strlen($content) <= $maxSize) {
            return $content;
        }

        return substr($content, 0, $maxSize) . '... [truncated]';
    }

    /**
     * Normalize array by limiting depth and item count to prevent log bloat
     */
    public function normalizeArray(array $data, int $maxItems = 50, int $maxDepth = 3, int $currentDepth = 0): array
    {
        if ($currentDepth >= $maxDepth) {
            return ['...' => 'Max depth reached'];
        }

        $result = [];
        $count = 0;

        foreach ($data as $key => $value) {
            if ($count >= $maxItems) {
                $remaining = count($data) - $count;
                $result['...'] = "Over {$maxItems} items ({$count} + {$remaining} total), truncated";
                break;
            }

            if (is_array($value)) {
                $result[$key] = $this->normalizeArray($value, $maxItems, $maxDepth, $currentDepth + 1);
            } else {
                $result[$key] = $value;
            }

            $count++;
        }

        return $result;
    }
}
