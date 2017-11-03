#!/usr/bin/env node

var program = require('commander');
const chalk = require('chalk');
var GitHub = require('github-base');
var nbOfDays = 90;
var roundedNbOfWeeks =  Math.floor(nbOfDays/7);


const authenticate = (options) => {
  var githubHandler;
  if(options.token){
    var githubHandler = new GitHub({
      token: options.token
    });
  } else if(options.username && options.password){
    var githubHandler = new GitHub({
      username: username,
      password: password,
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
    githubHandler.paged(url, function (err, res) {
        if(err){
          reject(err);
        } else {
          resolve(res);
        }
    });
  });
}

const getGithubRepoStats = (githubHandler, orgName, repoName) => {
  return new Promise((resolve, reject) => {
    githubHandler.paged('/repos/'+orgName+'/'+repoName+'/stats/contributors', function (err, res) {
        if(err){
          reject(err);
        } else {
          resolve(res);
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
        resolve(contributorsList);

    })
    .catch((error) => {
      reject(error);
    })
  })
}

program
  .version('1.0.0')
  .description('Snyk\'s Github contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <GHToken> (2FA setup) or -u <username> -pwd <password>  --private for commands on private repos only')


program
  .command('repoList <org>')
  .description('List all repos under an organization')
  .option('-p, --private', 'private repos only')
  .option('-t, --token [GHToken]', 'Running command with Personal Github Token (for 2FA setup)')
  .option('-u, --username [username]', 'username (use Token if you set 2FA on Github)')
  .option('-pwd, --password [password]', 'password')
  .action((org, options) => {
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
  .action((org, repo, options) => {
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
    .action((org, options) => {

      var github = authenticate(options);
      var promiseArray = [];
      getGithubOrgList(github, org, options.private)
      .then((data) => {
        if(options.private) console.log(chalk.red("\nPrivate Repos Only"));
        console.log(chalk.blue("\nTotal # of repos = "+data.length));
        console.log(chalk.blue("\nRepo list:"));
        for(i=0;i<data.length;i++){
            console.log(data[i].name);
            promiseArray.push(getGithubRepoSummaryStats(github, org, data[i].name));
        }
      })
      .then(() => {
        Promise.all(promiseArray)
        .then((data) => {
          // console.log(data.length);
          var contributorsList = {};
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
        })
      })
    });


program.parse(process.argv);

if (program.args.length === 0) program.help();
