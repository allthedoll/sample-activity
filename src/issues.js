const github = require("../lib/github");
const utils = require("../lib/utils");
const database = require("../lib/database")

/**
 * Iterate through all repositories where our GitHub App is installed, and
 * print out all issue comments created since a given time.
 */
async function main() {
    const days = 7

    const auth = github.getAuth();
    const app = github.getGitHubApp(auth);

    const commentsLastUpdated = new Date();
    const since = await utils.getSince(utils.TYPE_ISSUES, days)

    for await (const {octokit, repository} of app.eachRepository.iterator()) {
        console.log(`fetching issue comments for repository ${repository.full_name}`);
        let i = 0;

        try {
            const listCommentsForRepo = octokit.issues.listCommentsForRepo.endpoint.merge({
                owner: repository.owner.login,
                repo: repository.name,
                per_page: 100,
                since
            });

            // fetch all comments from `since` forward
            const comments = await octokit.paginate(listCommentsForRepo);
            console.log(`repository ${repository.full_name} found ${comments.length} issue comments`);

            for (const comment of comments) {
                if (comment.user.login !== 'ORG-devops-bot') {
                    console.log([comment.user.login, comment.updated_at, "comment", comment.html_url].join(","));
                    await database.updateUser(comment.user.login, comment.updated_at, "comment", comment.html_url)
                }
            }

            const listForRepo = octokit.issues.listForRepo.endpoint.merge({
                owner: repository.owner.login,
                repo: repository.name,
                per_page: 100,
                state: 'all',
                since
            });
            const issues = await octokit.paginate(listForRepo);
            console.log(`repository ${repository.full_name} found ${issues.length} issues`);
            for (const issue of issues) {
                if (new Date(issue.created_at) > new Date(since) && issue.user.login !== 'ORG-devops-bot') {
                    console.log([issue.user.login, issue.updated_at, "issue", issue.html_url].join(","));
                    await database.updateUser(issue.user.login, issue.updated_at, "issue", issue.html_url)
                }
            }
        } catch (e) {
            console.error(e);
            if (i++ >= 3) {
                throw e;
            }
        }
    }
    await database.setLastUpdated("comments", commentsLastUpdated.toISOString())
}

main()
