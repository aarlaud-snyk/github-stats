#!/usr/bin/env node
const INTER_CALLS_DELAY = 1000;

var program = require('commander');
const chalk = require('chalk');
var GitHub = require('github-base');
const figlet = require('figlet');

var nbOfDays = 90;
var roundedNbOfWeeks =  Math.floor(nbOfDays/7);

const EventEmitter = require('events').EventEmitter;
const eventEmitter = new EventEmitter();


const authenticate = (options) => {
  var githubHandler;
  var apiurl = 'https://api.github.com';
  if(options.apiurl){
      apiurl = options.apiurl;
  }
  if(options.token){
    var githubHandler = new GitHub({
      token: options.token,
      apiurl: apiurl,
    });
  } else if(options.username && options.password){
    var githubHandler = new GitHub({
      username: username,
      password: password,
      apiurl: apiurl,
    });
  } else {
    console.error(chalk.red("Invalid input ! Must provide token or username/password"));
    process.exit(1);
  }
  return githubHandler;
}

const getGithubOrgList = (githubHandler,orgName, privateReposOnly) => {
  return new Promise((resolve,reject) => {
    var url = '/orgs/'+orgName+'/repos?type=all'
    if(privateReposOnly) url = '/orgs/'+orgName+'/repos?type=private';
    githubHandler.paged(url, function (err, res, stream) {
        if(err){
          reject(err);
        } else {
          let interpretedResponse = interpretResponseCode(stream.statusCode);
          if(interpretedResponse == 'OK'){
            resolve(res);
          } else {
            reject(interpretedResponse);
          }

        }
    });
  });
}




const getGithubRepoStats = (githubHandler, orgName, repoName) => {
  return new Promise((resolve, reject) => {
    githubHandler.paged('/repos/'+orgName+'/'+repoName+'/stats/contributors', function (err, res, stream) {
        if(err){
          reject(err);
        } else {
          let interpretedResponse = interpretResponseCode(stream.statusCode);
          if(interpretedResponse == 'OK'){
            resolve(res);
          } else {
            console.error("Issue with "+orgName+"/"+repoName);
            reject({"error":interpretedResponse, "statusCode":stream.statusCode, "headers":stream.headers});
          }
        }
    });
  });
}

const getGithubRepoSummaryStats = (githubHandler, orgName, repoName) => {
  return new Promise((resolve,reject) => {
    getGithubRepoStats(githubHandler, orgName, repoName)
    .then((data) => {

        var rawCount = data.length;
        var contributorsList = [];
        for(i=0;i<data.length;i++){

          var nbOfWeeks = roundedNbOfWeeks;
          if(data[i].weeks.length < roundedNbOfWeeks){
            nbOfWeeks = data[i].weeks.length;
          }

          var nbOfCommits = 0;
          for(j=data[i].weeks.length-nbOfWeeks;j<data[i].weeks.length;j++){
              //weeksList.push(res[i].weeks[j].w+"-#commits "+res[i].weeks[j].c);
              if(data[i].weeks[j].c > 0){
                nbOfCommits += data[i].weeks[j].c;
              }
          }
          if(nbOfCommits > 0){
            contributorsList.push({'name':data[i].author.login, '# of commits' : nbOfCommits});
          }

        }
        eventEmitter.emit('promiseCompleted', repoName, contributorsList)
        resolve(contributorsList);

    })
    .catch((error) => {
      reject(error);
    })
  })
}

const registerEventListeners = (promiseArray) => {
  var repoStatsList = [];
  var lastMessage;
  // register a listener for the 'randomString' event
  eventEmitter.on('promiseCompleted', function (repoName, list) {
    console.log(list.length+" contributors for \t"+repoName);
    repoStatsList.push(list);
    setTimeout(() => {promiseProcess(promiseArray)}, INTER_CALLS_DELAY);
    //promiseProcess(promiseArray);
  });

  eventEmitter.on('allPromisesCompleted', function () {
    if(lastMessage){
      console.log(lastMessage);
    } else {
        consolidateContributorsList(repoStatsList);
    }

  });

  eventEmitter.on('setLastMessage', (message) => {
    lastMessage = message;
  });

  // eventEmitter.on('promiseFailed', function (repoName, list, error) {
  //      console.error("Promise failed");
  //      //TODO: Handle retry with proper backoff X-retry value or exponential if no retry
  //      console.error(error);
  // });
}

const promiseProcess = (promiseArray) => {
  if(promiseArray.length > 0){
    promiseArray[0]()
    .then(() => promiseArray.shift())
    .catch((error) => {
      if(error && error.statusCode == 202){
        console.log(error.error);
        eventEmitter.emit('setLastMessage', '\nGithub is processing data, please try again in a moment');
        promiseArray.shift();
        promiseProcess(promiseArray);
      } else if(error && error.statusCode == 403){
        //TODO: if X-Retry header value retry then, otherwise exponential backoff
      } else {
        console.error(error);
      }

      //eventEmitter.emit('promiseFailed', repoName, error)
    });

  } else if(promiseArray.length == 0){
    eventEmitter.emit('allPromisesCompleted');
  }
}

const consolidateContributorsList = (data) => {
  var contributorsList = []
  for(i=0;i<data.length;i++){

        for(j=0;j<data[i].length;j++){

          if(data[i][j].name in contributorsList){
            let commitCount = contributorsList[data[i][j].name]['# of commits'];
            contributorsList[data[i][j].name] = {'# of commits': commitCount + data[i][j]['# of commits']};
          } else {
            contributorsList[data[i][j].name] = {"# of commits": data[i][j]['# of commits']}
          }
        }

      }
        var contributorsCount = 0;
        for (x in contributorsList)
        { contributorsCount++; }
        console.log(chalk.red("\nTotal active contributors with commit in the last "+ nbOfDays + " days (rounded at "+roundedNbOfWeeks+" weeks) = "+ contributorsCount+"\n"));

        if(contributorsCount > 0){
          console.log(chalk.blue("Contributors List:"));
          console.log(contributorsList);
          console.log("\n");
        }
}

const introText = () => {
  figlet.text('SNYK', {
  font: 'Star Wars',
  horizontalLayout: 'default',
  verticalLayout: 'default'
}, function(err, data) {
  if (err) {
      console.log('Something went wrong...');
      console.dir(err);
      return;
  }
  console.log(data)
  console.log("\n");
  console.log("Snyk tool for counting active contributors");
  console.log("Respecting Github API Rate limiting best practices, so be patient :)");
});

}

program
  .version('1.0.0')
  .description('Snyk\'s Github contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <GHToken> (2FA setup) or -u <username> -pwd <password>  --private for commands on private repos only \n --apiurl <apiUrl if not api.github.com>')


program
  .command('repoList <org>')
  .description('List all repos under an organization')
  .option('-p, --private', 'private repos only')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.Github.com')
  .action((org, options) => {
    introText();
    var github = authenticate(options);
    getGithubOrgList(github, org, options.private)
    .then((data) => {
      if(options.private) console.log(chalk.red("\nPrivate Repos Only"));
      console.log(chalk.blue("\nTotal # of repos = "+data.length));
      console.log(chalk.blue("\nRepo list:"));
      for(i=0;i<data.length;i++){
          console.log(data[i].name);
      }
      console.log("\n");
    })
    .catch((error) => {
      console.error(error);
    });

  });


program
  .command('repoContributorCount [org] [repo]')
  .description('Count number of active contributors to Github repo')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.Github.com')
  .action((org, repo, options) => {
    introText();
    var github = authenticate(options);
    getGithubRepoStats(github, org, repo)
    .then((data) => {
        var rawCount = data.length;
        var contributorsList = [];
        for(i=0;i<data.length;i++){

          var nbOfWeeks = roundedNbOfWeeks;
          if(data[i].weeks.length < roundedNbOfWeeks){
            nbOfWeeks = data[i].weeks.length;
          }

          var nbOfCommits = 0;
          for(j=data[i].weeks.length-nbOfWeeks;j<data[i].weeks.length;j++){
              //weeksList.push(res[i].weeks[j].w+"-#commits "+res[i].weeks[j].c);
              if(data[i].weeks[j].c > 0){
                nbOfCommits += data[i].weeks[j].c;
              }
          }
          if(nbOfCommits > 0){
            contributorsList.push({'name':data[i].author.login, '# of commits' : nbOfCommits});
          }

        }


        console.log(chalk.red("\nTotal active contributors in the last "+nbOfDays+" days = " + contributorsList.length));
        console.log(chalk.blue("\nTotal contributors since first commit = " + rawCount));
        console.log(chalk.blue("\nDetails for the last " + nbOfDays + " days (rounded at "+ roundedNbOfWeeks + " weeks): "));
        console.log(contributorsList);
        console.log("\n");
    })
    .catch((error) => {
      console.error(error);
    })


  });

  program
    .command('orgContributorCount [org]')
    .description('Count number of active contributors to Github repo across an entire organization')
    .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
    .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
    .option('-pwd, --password [password]', 'password')
    .option('-p, --private', 'private repos only')
    .option('-apiurl, --apiurl [apiurl]', 'API url if not https://api.github.com')
    .action((org, options) => {
      introText();
      var github = authenticate(options);
      var promiseArray = [];


      getGithubOrgList(github, org, options.private)
      .then((data) => {
        if(options.private) console.log(chalk.red("\nPrivate Repos Only"));
        console.log(chalk.blue("\nTotal # of repos = "+data.length));
        //console.log(chalk.blue("\nRepo list:"));
        // for(i=0;i<data.length;i++){
        //     console.log(data[i].name);
        //     promiseArray.push(getGithubRepoSummaryStats(github, org, data[i].name));
        //
        // }
        promiseArray = data.map(repo => () => getGithubRepoSummaryStats(github, org, repo.name));
        registerEventListeners(promiseArray);
        promiseProcess(promiseArray);
      })
      .catch((err) => {console.error(err);})
    });


program.parse(process.argv);

if (program.args.length === 0) program.help();


const interpretResponseCode = (statusCode) => {
  var response = "";
  switch (statusCode) {
    case 200:
    case 204:
      response = "OK";
      break;
    case 202:
      response = "Github received listing request and is processing data. Please try again in a moment";
      break;
    case 404:
      response = "Organization cannot be found.";
      break;
    case 403:
      response = "Access Denied";
      break;
    default:
      response = "Unexpected response code: "+statusCode;
  }
  return response;
}
