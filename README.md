# Github list and stats extractor
## Simple CLI node app to extract details about github organization and repositories

[![Known Vulnerabilities](https://snyk.io/test/github/aarlaud-snyk/github-stats/badge.svg)](https://snyk.io/test/github/aarlaud-snyk/github-stats)


##### Packages: Node JS CLI app using commander, chalk, and github-base

### Installation (globally to use as CLI)
npm install -g

### Usage
- github-stats repoList \<Org name\> -t \<GitHubToken\>
- github-stats repoContributorCount \<Org name\> \<Repo Name\> -t \<GitHubToken\>
- github-stats orgContributorCount \<Org name\>  -t \<GitHubToken\>
- Use -p or --private to restrict to private repos only (repoList and orgContributorCount only)
## Github does not return results immediately. So it is very likely not to return any results at first. Try again after a few minutes and you'll get the results. This will be more gracefully handled in the next iteration. (see [![Github's word about caching](https://developer.github.com/v3/repos/statistics/))](https://developer.github.com/v3/repos/statistics/)

#### Commands
- repoList: List all repositories under an organization. Can filter on private repos only (--private).
- repoContributorCount: List the number of active contributors for a specific repositories
- orgContributorCount: List the number of active contributors for an entire organization.. Can filter on private repos only (--private).

##### An active contributor to a repo is someone who has committed code at least once in the last 90 days.

#### Prerequisites
- Node 8 (ES6 support for Promises)
- Be member of the organization for private repositories
- Github credentials

# Untested
1. username and password attempts, mainly because I have 2FA enabled so need a token. Do yourself a favor, please enable 2FA regardless
