#!/usr/bin/env node
'use strict'

const INTER_CALLS_DELAY = 1000

var program = require('commander')
const chalk = require('chalk')
var GitHub = require('github-base')
const figlet = require('figlet')
var fs = require('fs')
var path = require('path')

var nbOfDays = 90
var roundedNbOfWeeks = Math.floor(nbOfDays / 7)
var filePath = path.join(__dirname, '/tmp/')
var organization = ''
const EventEmitter = require('events').EventEmitter
const eventEmitter = new EventEmitter()

// Adding global Exception tracing
process.on('uncaughtException', function onUncaughtException (err) {
  console.err('uncaught Exception', err)
})
process.on('unhandledRejection', function onUnhandledRejection (err) {
  console.err('unhandled Rejection', err)
})

const authenticate = (options) => {
  var githubHandler
  var apiurl = 'https://api.github.com'
  if (options.apiurl) {
    if (options.apiurl.substring(0, 8) !== 'https://' || !options.apiurl.includes('/api/v3')) {
      console.log('The api url should look like https://mygheinstanceurl.mycompany.com/api/v3')
      process.exit(1)
    }
    // console.log(options.apiurl.includes('/api/v3'));
    // if(options.apiurl.substring(0,7))
    apiurl = options.apiurl
  }
  if (options.token) {
    githubHandler = new GitHub({
      token: options.token,
      apiurl: apiurl
    })
  } else if (options.username && options.password) {
    githubHandler = new GitHub({
      username: options.username,
      password: options.password,
      apiurl: apiurl
    })
  } else {
    console.error(chalk.red('Invalid input ! Must provide token or username/password'))
    process.exit(1)
  }
  return githubHandler
}

const getGithubOrgList = (githubHandler, orgName, privateReposOnly) => {
  return new Promise((resolve, reject) => {
    var url = '/orgs/' + orgName + '/repos?type=all'
    if (privateReposOnly) url = '/orgs/' + orgName + '/repos?type=private'
    githubHandler.paged(url, function (err, res, stream) {
      if (err) {
        reject(err)
      } else {
        let interpretedResponse = interpretResponseCode(stream.statusCode)
        if (interpretedResponse === 'OK') {
          resolve(res)
        } else {
          reject(interpretedResponse)
        }
      }
    })
  })
}

const getGithubRepoStats = (githubHandler, orgName, repoName) => {
  return new Promise((resolve, reject) => {
    githubHandler.paged('/repos/' + orgName + '/' + repoName + '/stats/contributors', function (err, res, stream) {
      if (err) {
        reject(err)
      } else {
        let interpretedResponse = interpretResponseCode(stream.statusCode)
        if (interpretedResponse === 'OK') {
          resolve(res)
        } else {
          console.error('Issue with ' + orgName + '/' + repoName)
          reject({ 'error': interpretedResponse, 'statusCode': stream.statusCode, 'headers': stream.headers })
        }
      }
    })
  })
}

const getGithubRepoSummaryStats = (githubHandler, orgName, repoName, isForked) => {
  return new Promise((resolve, reject) => {
    getGithubRepoStats(githubHandler, orgName, repoName)
      .then((data) => {
        var contributorsList = []
        for (var i = 0; i < data.length; i++) {
          var nbOfWeeks = roundedNbOfWeeks
          if (data[i].weeks.length < roundedNbOfWeeks) {
            nbOfWeeks = data[i].weeks.length
          }

          var nbOfCommits = 0
          for (var j = data[i].weeks.length - nbOfWeeks; j < data[i].weeks.length; j++) {
            // weeksList.push(res[i].weeks[j].w+"-#commits "+res[i].weeks[j].c);
            if (data[i].weeks[j].c > 0) {
              nbOfCommits += data[i].weeks[j].c
            }
          }
          if (nbOfCommits > 0 && isForked === false) {
            contributorsList.push({ 'name': data[i].author.login, '# of commits': nbOfCommits })
          } else if (nbOfCommits > 0 && isForked === true) {
            contributorsList.push({ 'fork': true, 'name': data[i].author.login, '# of commits': nbOfCommits })
          }
        }

        eventEmitter.emit('promiseCompleted', repoName, contributorsList)
        resolve(contributorsList)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

const registerEventListeners = (promiseArray) => {
  var lastMessage
  // register a listener for the 'randomString' event
  eventEmitter.on('promiseCompleted', function (repoName, list) {
    console.log(list.length + ' contributors for \t' + repoName)
    // repoStatsList.push(list);
    fs.readFile(filePath + organization, 'utf8', function (err, contents) {
      if (err) {
        throw new Error(err.message)
      }
      var repoListArray = JSON.parse(contents)
      var newContent = []
      for (var i = 0; i < repoListArray.length; i++) {
        if (repoListArray[i].name === repoName) {
          // console.log({"name":repoListArray[i].name, "forked":repoListArray[i].forked, "contributorsList":list});
          newContent.push({ 'name': repoListArray[i].name, 'forked': repoListArray[i].forked, 'contributorsList': list })
        } else {
          newContent.push(repoListArray[i])
        }
      }

      fs.writeFile(filePath + organization, JSON.stringify(newContent), function (err) {
        if (err) {
          throw new Error(err.message)
        }
        setTimeout(() => { promiseProcess(promiseArray) }, INTER_CALLS_DELAY)
      })
    })
  })

  eventEmitter.on('allPromisesCompleted', function () {
    if (lastMessage) {
      console.log(chalk.red(lastMessage))
    } else {
      // consolidateContributorsList(repoStatsList);
      consolidateContributorsList()
    }
  })

  eventEmitter.on('setLastMessage', (message) => {
    lastMessage = message
  })

  // eventEmitter.on('promiseFailed', function (repoName, list, error) {
  //      console.error("Promise failed");
  //      //TODO: Handle retry with proper backoff X-retry value or exponential if no retry
  //      console.error(error);
  // });
}

const promiseProcess = (promiseArray) => {
  if (promiseArray.length > 0) {
    promiseArray[0]()
      .then(() => promiseArray.shift())
      .catch((error) => {
        if (error && error.statusCode === 202) {
          console.log(error.error)
          eventEmitter.emit('setLastMessage', '\nGithub is processing data, please try again in a moment.\nIt may take multiple runs to go through all the repos.\nPlease rerun until you see the contributors count displayed')
          promiseArray.shift()
          promiseProcess(promiseArray)
        } else if (error && error.statusCode === 403) {
        // TODO: if X-Retry header value retry then, otherwise exponential backoff
          console.error('403!')
          console.error(error)
        } else {
          console.error(error)
        }

      // eventEmitter.emit('promiseFailed', repoName, error)
      })
  } else if (promiseArray.length === 0) {
    eventEmitter.emit('allPromisesCompleted')
  }
}

const consolidateContributorsList = (data = null) => {
  var contributorsList = []
  var forkcontributorsList = []
  fs.readFile(filePath + organization, 'utf8', function (err, contents) {
    var data = JSON.parse(contents)
    if (err) {
      throw new Error(err.message)
    }
    for (var i = 0; i < data.length; i++) {
      for (var j = 0; j < data[i].contributorsList.length; j++) {
        if (data[i].forked) {
          if (data[i].contributorsList[j].name in forkcontributorsList) {
            let commitCount = forkcontributorsList[data[i].contributorsList[j].name]['# of commits']
            forkcontributorsList[data[i].contributorsList[j].name] = { '# of commits': commitCount + data[i].contributorsList[j]['# of commits'] }
          } else {
            forkcontributorsList[data[i].contributorsList[j].name] = { '# of commits': data[i].contributorsList[j]['# of commits'] }
          }
        } else {
          if (data[i].contributorsList[j].name in contributorsList) {
            let commitCount = contributorsList[data[i].contributorsList[j].name]['# of commits']
            contributorsList[data[i].contributorsList[j].name] = { '# of commits': commitCount + data[i].contributorsList[j]['# of commits'] }
          } else {
            contributorsList[data[i].contributorsList[j].name] = { '# of commits': data[i].contributorsList[j]['# of commits'] }
          }
        }
      }
    }
    var contributorsCount = 0
    for (var x in contributorsList) { contributorsCount++ }
    console.log(chalk.red('\nTotal active contributors with commit in the last ' + nbOfDays + ' days (rounded at ' + roundedNbOfWeeks + ' weeks) = ' + contributorsCount + '\n'))

    if (contributorsCount > 0) {
      console.log(chalk.blue('Contributors List:'))
      console.log(contributorsList)
      console.log('\n')
    }

    var forkContributorsCount = 0
    for (x in forkcontributorsList) { forkContributorsCount++ }
    console.log(chalk.red('\nTotal forked repo active contributors with commit in the last ' + nbOfDays + ' days (rounded at ' + roundedNbOfWeeks + ' weeks) = ' + forkContributorsCount + '\n'))

    if (contributorsCount > 0) {
      console.log(chalk.blue('Fork Contributors List:'))
      console.log(forkcontributorsList)
      console.log('\n')
    }
  })

  // for(i=0;i<data.length;i++){
  //
  //       for(j=0;j<data[i].length;j++){
  //         if(data[i][j].fork){
  //           if(data[i][j].name in forkcontributorsList){
  //             let commitCount = forkcontributorsList[data[i][j].name]['# of commits'];
  //             forkcontributorsList[data[i][j].name] = {'# of commits': commitCount + data[i][j]['# of commits']};
  //           } else {
  //             forkcontributorsList[data[i][j].name] = {"# of commits": data[i][j]['# of commits']}
  //           }
  //         } else {
  //           if(data[i][j].name in contributorsList){
  //             let commitCount = contributorsList[data[i][j].name]['# of commits'];
  //             contributorsList[data[i][j].name] = {'# of commits': commitCount + data[i][j]['# of commits']};
  //           } else {
  //             contributorsList[data[i][j].name] = {"# of commits": data[i][j]['# of commits']}
  //           }
  //         }
  //       }
  //
  //     }
  //       var contributorsCount = 0;
  //       for (x in contributorsList)
  //       { contributorsCount++; }
  //       console.log(chalk.red("\nTotal active contributors with commit in the last "+ nbOfDays + " days (rounded at "+roundedNbOfWeeks+" weeks) = "+ contributorsCount+"\n"));
  //
  //       if(contributorsCount > 0){
  //         console.log(chalk.blue("Contributors List:"));
  //         console.log(contributorsList);
  //         console.log("\n");
  //       }
  //
  //       var forkContributorsCount = 0;
  //       for (x in forkcontributorsList)
  //       { forkContributorsCount++; }
  //       console.log(chalk.red("\nTotal forked repo active contributors with commit in the last "+ nbOfDays + " days (rounded at "+roundedNbOfWeeks+" weeks) = "+ forkContributorsCount+"\n"));
  //
  //       if(contributorsCount > 0){
  //         console.log(chalk.blue("Fork Contributors List:"));
  //         console.log(forkcontributorsList);
  //         console.log("\n");
  //       }
}

const introText = () => {
  figlet.text('SNYK', {
    font: 'Star Wars',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  }, function (err, data) {
    if (err) {
      console.log('Something went wrong...')
      console.dir(err)
      return
    }
    console.log(data)
    console.log('\n')
    console.log('Snyk tool for counting active contributors')
    console.log('Respecting Github API Rate limiting best practices, so be patient :)')
  })
}

program
  .version('1.0.0')
  .description('Snyk\'s Github contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <GHToken> (2FA setup) or -u <username> -pwd <password>  --private for commands on private repos only \n --apiurl <apiUrl if not https://api.github.com. Includes scheme an api path, ie https://myusualgheurl.company.com/api/v3>')

program
  .command('repoList <org>')
  .description('List all repos under an organization')
  .option('-p, --private', 'private repos only')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .option('-r, --raw', 'Raw output')
  .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.Github.com')
  .action((org, options) => {
    if (!options.raw) {
      introText()
    }
    var github = authenticate(options)
    getGithubOrgList(github, org, options.private)
      .then((data) => {
        if (!options.raw) {
          if (options.private) console.log(chalk.red('\nPrivate Repos Only'))
          console.log(chalk.blue('\nTotal # of repos = ' + data.length))
          console.log(chalk.blue('\nRepo list:'))
        }
        var forkedRepos = []
        for (var i = 0; i < data.length; i++) {
          if (data[i].fork) {
            forkedRepos.push(data[i].name)
          } else {
            console.log(data[i].name)
          }
        }
        if (!options.raw) {
          console.log(chalk.blue('\nForked Repo list:'))
        }
        for (i = 0; i < forkedRepos.length; i++) {
          console.log(forkedRepos[i])
        }

        console.log('\n')
      })
      .catch((error) => {
        console.error(error)
      })
  })

program
  .command('repoContributorCount [org] [repo]')
  .description('Count number of active contributors to Github repo')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .option('-r, --raw', 'raw output')
  .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.Github.com')
  .action((org, repo, options) => {
    if (!options.raw) introText()
    var github = authenticate(options)
    getGithubRepoStats(github, org, repo)
      .then((data) => {
        var rawCount = data.length
        var contributorsList = []
        for (var i = 0; i < data.length; i++) {
          var nbOfWeeks = roundedNbOfWeeks
          if (data[i].weeks.length < roundedNbOfWeeks) {
            nbOfWeeks = data[i].weeks.length
          }

          var nbOfCommits = 0
          for (var j = data[i].weeks.length - nbOfWeeks; j < data[i].weeks.length; j++) {
            // weeksList.push(res[i].weeks[j].w+"-#commits "+res[i].weeks[j].c);
            if (data[i].weeks[j].c > 0) {
              nbOfCommits += data[i].weeks[j].c
            }
          }
          if (nbOfCommits > 0) {
            if (options.raw) {
              contributorsList.push(data[i].author.login)
            } else {
              contributorsList.push({ 'name': data[i].author.login, '# of commits': nbOfCommits })
            }
          }
        }

        if (!options.raw) {
          console.log(chalk.red('\nTotal active contributors in the last ' + nbOfDays + ' days = ' + contributorsList.length))
          console.log(chalk.blue('\nTotal contributors since first commit = ' + rawCount))
          console.log(chalk.blue('\nDetails for the last ' + nbOfDays + ' days (rounded at ' + roundedNbOfWeeks + ' weeks): '))
          console.log(contributorsList)
          console.log('\n')
        } else {
          console.log(contributorsList)
          console.log('\n')
        }
      })
      .catch((error) => {
        console.error(error)
      })
  })

program
  .command('orgContributorCount [org]')
  .description('Count number of active contributors to Github repo across an entire organization')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .option('-p, --private', 'private repos only')
  .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.github.com')
  .action((org, options) => {
    introText()

    var github = authenticate(options)
    var promiseArray = []
    organization = org

    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath)
    }
    if (fs.existsSync(filePath + organization)) {
      console.log(chalk.red('\nWorking off file repoList in tmp folder. Delete file to restart counting from scratch'))
      fs.readFile(filePath + organization, 'utf8', function (err, contents) {
        if (err) {
          throw new Error(err.message)
        }
        var repoListArray = JSON.parse(contents)
        var repoToBeProcessed = []
        for (var i = 0; i < repoListArray.length; i++) {
          if (!repoListArray[i].hasOwnProperty('contributorsList')) {
            repoToBeProcessed.push(repoListArray[i])
          }
        }

        var repoArray = repoToBeProcessed.map(repo => () =>
          getGithubRepoSummaryStats(github, org, repo.name, repo.forked)
        )
        registerEventListeners(repoArray)
        promiseProcess(repoArray)
        // console.log("done !");
      })
    } else {
      getGithubOrgList(github, org, options.private)
        .then((data) => {
          if (options.private) console.log(chalk.red('\nPrivate Repos Only'))
          console.log(chalk.blue('\nTotal # of repos = ' + data.length))
          var repoArray = data.map(repo => { return { 'name': repo.name, 'forked': repo.fork } })
          fs.writeFile(filePath + organization, JSON.stringify(repoArray), function (err) {
            if (err) {
              return console.log(err)
            }
          })

          promiseArray = data.map(repo => () =>
            getGithubRepoSummaryStats(github, org, repo.name, repo.fork)
          )
          registerEventListeners(promiseArray)
          promiseProcess(promiseArray)
        })
        .catch((err) => { console.error(err) })
    }
  })

program.parse(process.argv)

if (program.args.length === 0) program.help()

const interpretResponseCode = (statusCode) => {
  var response = ''
  switch (statusCode) {
    case 200:
    case 204:
      response = 'OK'
      break
    case 202:
      response = 'Github received listing request and is processing data. Please try again in a moment'
      break
    case 404:
      response = 'Organization cannot be found.'
      break
    case 403:
      response = 'Access Denied'
      break
    default:
      response = 'Unexpected response code: ' + statusCode
  }
  return response
}
