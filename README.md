# Remix of Foundation First

FIRST TASK — FRESH BUILD FOUNDATION REVIEW

Do not begin implementation yet.

Do not begin with the homepage.

Do not create database tables yet.

Do not build agents.

Do not create 100 Career Packs.

Do not generate the complete UI.

First:

read all three uploaded Clear Routes document completely;

read this master prompt;

reconcile them into one coherent fresh-build architecture;

identify any contradictions, duplication or legacy assumptions;

distinguish:

fundamental product requirements;

engineering requirements;

design requirements;

operational requirements;

commercial requirements;

future/deferred requirements;

identify anything from the documents that should not be carried into the fresh architecture;

propose the smallest coherent technical foundation capable of supporting the complete long-term product;

produce the Fresh Build Foundation Report below.

REQUIRED FRESH BUILD FOUNDATION REPORT

Return the following before making substantial code changes.

A. Product interpretation

Explain in concise terms:

what Clear Routes is;

who it serves;

what participant problem it solves;

what institutional problem it solves;

what its core loop is;

what it must not become.

B. Architectural interpretation

Define the major technical domains and the authoritative owner for:

identity;

institutions;

occupations;

Career Packs;

Reality Checks;

Decision Engine;

Local Reality;

decisions;

progression;

barriers;

adviser support;

reassessment;

evidence;

sources;

agents;

analytics;

reporting;

administration.

C. Proposed repository structure

Give an exact proposed top-level directory structure for the new codebase.

Do not recreate the structure of the legacy application unless independently justified.

D. Proposed database domains and ERD direction

List the proposed entities/tables by domain.

For each major entity explain:

its responsibility;

important relationships;

whether it is mutable or immutable;

institution/participant ownership;

whether historical versions are required.

Do not create the database yet.

E. Decision Engine boundary

Explain precisely:

what inputs the engine receives;

what it calculates;

what it does not calculate;

where AI may assist;

where AI has no authority;

how determinism will be preserved.

F. Career Pack boundary

Explain precisely what belongs in:

reusable application code;

route archetypes;

reusable question modules;

Career Pack configuration;

evidence;

Local Reality configuration.

A normal new career must not require a new software engine.

G. Occupation Universe approach

Explain how the system can eventually recognise broad UK occupation coverage while allowing decision depth to scale progressively.

H. Local Reality approach

Explain how postcode, providers, programmes, apprenticeships, vacancies and local availability will connect to route evaluation without falsely treating lack of a current vacancy as route impossibility.

I. Participant architecture

Map the canonical participant states from:

Search → Reality Check → Result → Compare → Choose → My Route → Actions/Barriers → Support → Reassess.

J. Staff/institution architecture

Map:

Cohort → participant activity → Needs Attention → participant record → intervention → progress → reporting.

K. Evidence/source architecture

Explain:

source identity;

evidence records;

provenance;

freshness;

source health;

review;

withdrawal;

publication control.

L. Agent architecture

List which agents are justified and explicitly state their authority boundaries.

Agents must support the platform; they must not become the runtime source of truth.

M. Security and tenancy

Propose:

authentication model;

participant ownership;

institution ownership;

staff roles;

RLS strategy;

audit strategy;

trusted assessment submission;

historical result integrity.

N. Design-system direction

Summarise the visual and interaction principles from the Product and Design Artefacts.

Do not design all screens yet.

O. Operations required by the architecture

Identify which internal operational capabilities must eventually exist so Clear Routes can be maintained safely.

P. Commercial implications that affect engineering

Identify only commercial requirements that materially affect architecture—for example:

institutions;

cohorts;

reports;

auditability;

licence structure;

pilot measurement;

renewal evidence.

Do not build sales functionality into the participant product.

Q. Proposed implementation sequence

Produce the first 10–15 implementation increments in strict dependency order.

Each increment must contain:

objective;

dependencies;

key entities/modules;

acceptance criteria;

explicit out-of-scope items.

R. Deferred scope

Create a clear “Not Yet” list so later features do not contaminate the initial architecture.

S. Risks

Identify:

overengineering risks;

scope-drift risks;

data-model risks;

AI-authority risks;

institutional-privacy risks;

scaling risks;

anything in the uploaded documents that could accidentally recreate the legacy architecture.

T. Recommendation

State whether the three documents plus this prompt are internally coherent enough to begin the fresh implementation.

If not, identify only the decisions that genuinely block the foundation.

Do not start broad implementation until this report has been reviewed.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9dea0476-cb5f-4385-83aa-40526166d55d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
