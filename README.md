# Github list and stats extractor (both Github.com and Github Enterprise)
## Simple CLI node app to extract details about github organization and repositories

[![Known Vulnerabilities](https://snyk.io/test/github/aarlaud-snyk/github-stats/badge.svg)](https://snyk.io/test/github/aarlaud-snyk/github-stats)
[![CircleCI](https://circleci.com/gh/aarlaud-snyk/github-stats.svg?style=svg)](https://circleci.com/gh/aarlaud-snyk/github-stats)

## **This tool is deprecated, please refer to this [Tool](https://github.com/snyk-tech-services/snyk-scm-contributors-count) instaed**
##### Packages: Node JS CLI app using commander, chalk, and github-base

### Installation
1. git clone https://github.com/aarlaud-snyk/github-stats
2. npm install

#### Prerequisites
- Node 8 (ES6 support for Promises)
- Be member of the organization for private repositories
- **full repo scope granted** to personal access token (how to: https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line or click on this https://github.com/settings/tokens if logged in).
- Github credentials
- If using Github Enterprise, you'll need your api endpoint. Usually looks like the base url you know appended with /api/v3, i.e https://my-ghe-instance.mycompany.com/api/v3.

### Usage
- node index.js repoList \<Org name\> -t \<GitHubToken\>
- node index.js repoContributorCount \<Org name\> \<Repo Name\> -t \<GitHubToken\>
- node index.js orgContributorCount \<Org name\>  -t \<GitHubToken\>

Example: node index.js orgContributorCount snyk -t <my_github_token>

#### Useful flags
- Use -p or --private to restrict to private repos only (repoList and orgContributorCount only)
- use --apiurl to set the url of your Github Enterprise instance __**API Endpoint**__ (i.e --apiurl=https://my-ghe-instance.company.com/api/v3)
- if using proxy, exporting the http_proxy settings should do the trick. Google search the details of how to set that up, pretty straightforward.

## <span style="color:red">You might need multiple runs to get the results.__Github does not return results immediately__. So it is very likely not to return any results at first. Try again after a short moment. If you have a lot of repos in the organization, you might need to run it multiple times until the total number is extracted </span> (details about [Github's word about caching](https://developer.github.com/v3/repos/statistics/))

#### Commands
- repoList: List all repositories under an organization. Can filter on private repos only (--private).
- repoContributorCount: List the number of active contributors for a specific repositories
- orgContributorCount: List the number of active contributors for an entire organization.. Can filter on private repos only (--private).

##### An active contributor to a repo is someone who has committed code at least once in the last 90 days.


# Untested
1. username and password attempts, mainly because I have 2FA enabled so need a token. Do yourself a favor, please enable 2FA regardless
