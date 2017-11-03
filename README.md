# Github list and stats extractor
## Simple CLI node app to extract details about github organization and repositories

[![Known Vulnerabilities](https://snyk.io/test/github/aarlaud-snyk/github-stats/badge.svg)](https://snyk.io/test/github/aarlaud-snyk/github-stats)


##### Packages: Node JS CLI app using commander, chalk, and github-base

### Installation (globally to use as CLI)
npm install -g

#### Commands
- repoList: List all repositories under an organization. Can filter on private repos only (--private).
- repoContributorCount: List the number of active contributors for a specific repositories
- orgContributorCount: List the number of active contributors for an entire organization.. Can filter on private repos only (--private).

##### An active contributor to a repo is someone who has committed code at least once in the last 90 days.

#### Prerequisites
- Be member of the organization for private repositories
- Github credentials

# Untested
1. username and password attempts, mainly because I have 2FA enabled so need a token. Do yourself a favor, please enable 2FA regardless
