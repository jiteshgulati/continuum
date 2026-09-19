# PaymentWorker deployment update

Expert: Arjun Rao, Platform Engineering
Knowledge area: Deployment

The new CI/CD pipeline automatically restarts PaymentWorker after deploying its
container. Engineers no longer need to restart PaymentWorker manually.

After rollout, check the worker readiness signal and confirm that queue consumers
are processing messages. Do not trigger a manual restart while deployment is in
progress.

This differs from the old runbook, which required a manual PaymentWorker restart.
A reviewer should confirm when the pipeline change took effect and whether any
older environments still need the old procedure.

This document is synthetic evidence supplied for the example workspace.
