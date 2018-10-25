var chalk = require('chalk')
var fs = require('fs')
var path = require('path')

var filePath = path.join(__dirname, '/tmp/')
var nbOfDays = 90
var roundedNbOfWeeks = Math.floor(nbOfDays / 7)

const processLists = (organization, data = null) => {
  consolidateContributorsList(organization, data)
    .then(lists => displayResults(lists['list'], lists['forkedList']))
    .catch((err) => { throw new Error(err) })
}

const consolidateContributorsList = (organization, data = null) => {
  return new Promise((resolve, reject) => {
    var contributorsList = []
    var forkContributorsList = []
    fs.readFile(filePath + organization, 'utf8', function (err, contents) {
      var data = JSON.parse(contents)
      if (err) {
        throw new Error(err.message)
        reject(err)
      }
      for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].contributorsList.length; j++) {
          if (data[i].forked) {
            if (data[i].contributorsList[j].name in forkContributorsList) {
              let commitCount = forkContributorsList[data[i].contributorsList[j].name]['# of commits']
              forkContributorsList[data[i].contributorsList[j].name] = { '# of commits': commitCount + data[i].contributorsList[j]['# of commits'] }
            } else {
              forkContributorsList[data[i].contributorsList[j].name] = { '# of commits': data[i].contributorsList[j]['# of commits'] }
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
      resolve({ 'list': contributorsList, 'forkedList': forkContributorsList })
    })
  })
}

const displayResults = (contributorsList, forkcontributorsList) => {
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
}

module.exports = { processLists, consolidateContributorsList }
