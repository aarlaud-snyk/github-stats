var GitHub = require('github-base')
var chalk = require('chalk')

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

module.exports = { authenticate, getGithubOrgList }
