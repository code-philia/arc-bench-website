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

## Identity and Competition Participation

**Account**:
The credentials and profile through which a person signs in. An Account is not, by itself, permission to enter every Competition.

**Identity**:
The stable link between an ARC-Bench Account and an account issued by an authentication provider. A Hackathon Identity is identified by the provider's immutable user ID, not by an email address.

**Competition Access Grant**:
Permission for an Account to view and participate in a particular Competition (or every Competition). It is distinct from the Account's registration origin.

**Internal Beta Participant**:
An ARC-Bench Account that has redeemed an internal beta invitation and therefore has a global Competition Access Grant.

**Hackathon Participant**:
An Account with a confirmed Hackathon Identity and an access grant limited to the Hackathon Competition. It retains ordinary access to non-competition ARC-Bench features.

**Competition Entry**:
The accountable participant in one Competition. It is either one individual Account or one Team, never both. Competition Submissions, Runs, and leaderboard scores belong to the Competition Entry; the initiating Account is recorded separately.

**Team**:
A named group of Accounts participating through one Competition Entry. Team membership may change, but a historical Submission or Run keeps the Competition Entry that owned it when it was created.

**Team Join Request**:
A pending request for an Account to join a Team. It is accepted or declined by that Team's leader through an ARC-Bench notification; an Account cannot belong to more than one Team.

**Submitting Member**:
Any current member of a Team who creates a Team-owned Competition Submission. The submitting member is an audit attribute and does not change the Team's ownership of the Submission or Run.
