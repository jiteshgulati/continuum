# Payment API 502 incident

Expert: Rahul Sharma, Backend Engineering
Knowledge area: Payments

During a traffic spike, the payment API returned intermittent HTTP 502 responses.
The first thing we checked was the Redis connection count. The Redis connection
limit had been exhausted. We then inspected API Gateway logs and compared the
error rate with incoming traffic.

Do not immediately retry every failed payment request. In this incident the retry
storm amplified the load and made recovery slower. Preserve idempotency keys so
that a retry cannot accidentally create a duplicate payment.

This is a record of a specific incident. Confirm that the same dependency failure
is present before applying its diagnosis to a new outage.

This document is synthetic evidence supplied for the example workspace.
