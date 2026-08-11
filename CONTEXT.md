# ARC-Bench Submission and Execution

This context defines the lifecycle of user-supplied agents in Playground and Competition workflows.

## Language

**Submission**:
An immutable uploaded agent snapshot, owned by one user and scoped to either a Playground task or a Competition. It is not an execution result.
_Avoid_: Run, execution, attempt

**Run**:
One isolated execution of one Submission against one concrete requirement task. It owns execution status, workspace artifacts, logs, timings, and evaluation metrics.
_Avoid_: Submission result, task submission

**Competition Submission**:
A Submission scoped to a competition and reusable for its published tasks. Every Run uses the user's latest such Submission at the time it is created.
_Avoid_: Competition run, task submission

**Playground Submission**:
A Submission scoped to one Playground task. It can have multiple Runs, although the normal quick-start flow creates its first Run immediately.
_Avoid_: Playground run

**Current Task Score**:
The metrics of a Submission's most recently completed Run for a given competition task.

**Final Competition Score**:
The highest average Current Task Score test-pass rate among a user's Competition Submissions; unrun tasks contribute zero.
