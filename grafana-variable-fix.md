# Grafana Dashboard Variable Fix Guide

Since Grafana's built-in variable chaining has limitations, here are 3 proven solutions:

## Solution 1: Manual Variable Update (Simplest)

In your current dashboard, manually update the `pod_pattern` variable each time you change the project:

1. Click on Dashboard Settings (gear icon)
2. Go to Variables
3. Find `pod_pattern` variable
4. Update the "Custom options" field with the appropriate regex for your selected project

**Project to Regex Mapping:**
```
dodgeprint-dev:    ^dev-dodgeprint-.*|^dev-redis-.*|^mysql-dev-dodgeprint-.*
dodgeprint-stg:    ^stg-dodgeprint-.*|^stg-redis-.*|^stg-rabbitmq-.*|^mysql-stg-dodgeprint-.*
dodgeprint:        ^dodgeprint-.*|^doks-dodgeprint-.*|^redis-.*|^rabbitmq-.*|^nginx-.*|^prometheus-dodgeprint-.*|^mysql-backup-.*|^mysql-response-backup-.*
shipresolve-dev:   ^dev-shipresolve-.*
shipresolve-stg:   ^stg-shipresolve-.*
shipresolve:       ^shipresolve-.*|^sidccorp-fw-.*
```

## Solution 2: Use Namespace-based Filtering (Recommended)

If your projects are organized by Kubernetes namespaces, modify the dashboard to use namespace filtering:

1. Create a namespace variable:
```json
{
  "name": "namespace",
  "type": "query",
  "query": "label_values(kube_pod_info, namespace)",
  "datasource": "prometheus"
}
```

2. Update all queries to filter by namespace:
```
count(kube_pod_info{namespace="$namespace"})
```

## Solution 3: Create Separate Dashboards

Create individual dashboards for each project with hardcoded pod patterns:

- `kubernetes-dodgeprint-dev.json`
- `kubernetes-dodgeprint-stg.json`
- `kubernetes-dodgeprint-prod.json`
- `kubernetes-shipresolve-dev.json`
- `kubernetes-shipresolve-stg.json`
- `kubernetes-shipresolve-prod.json`

Then use Grafana's dashboard links to switch between them.

## Solution 4: Use Grafana's Text Panel with JavaScript (Advanced)

Add a hidden text panel with JavaScript that updates variables:

```javascript
// Add this in a Text panel with HTML mode
<script>
document.addEventListener('DOMContentLoaded', function() {
  const projectMappings = {
    'dodgeprint-dev': '^dev-dodgeprint-.*|^dev-redis-.*|^mysql-dev-dodgeprint-.*',
    'dodgeprint-stg': '^stg-dodgeprint-.*|^stg-redis-.*|^stg-rabbitmq-.*|^mysql-stg-dodgeprint-.*',
    'dodgeprint': '^dodgeprint-.*|^doks-dodgeprint-.*|^redis-.*|^rabbitmq-.*|^nginx-.*|^prometheus-dodgeprint-.*|^mysql-backup-.*|^mysql-response-backup-.*',
    'shipresolve-dev': '^dev-shipresolve-.*',
    'shipresolve-stg': '^stg-shipresolve-.*',
    'shipresolve': '^shipresolve-.*|^sidccorp-fw-.*'
  };
  
  // Monitor project variable changes
  const observer = new MutationObserver(function(mutations) {
    const projectValue = window.grafanaBootData.settings.templating.list
      .find(v => v.name === 'project')?.current?.value;
    
    if (projectValue && projectMappings[projectValue]) {
      // Update pod_pattern variable
      const podPatternVar = window.grafanaBootData.settings.templating.list
        .find(v => v.name === 'pod_pattern');
      if (podPatternVar) {
        podPatternVar.current.value = projectMappings[projectValue];
        podPatternVar.current.text = projectMappings[projectValue];
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
});
</script>
```

## Quick Fix for Your Current Dashboard

Since you need a working solution immediately, here's what I recommend:

1. **Use the v2 dashboard** I created with manual pattern selection
2. When you select a project, also select the corresponding pod pattern from the second dropdown
3. Or implement Solution 2 (namespace-based) if your projects use different namespaces

The most reliable long-term solution is to organize your Kubernetes resources by namespace and filter based on that, as it's a native Kubernetes concept that Grafana handles well.