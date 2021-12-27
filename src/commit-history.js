const github = require("../lib/github");
const utils = require("../lib/utils");
const database = require("../lib/database")

async function main() {
    const owner = 'org-name'
    const days = 7

    const auth = github.getAuth();
    const app = github.getGitHubApp(auth);

    const commitsLastUpdated = new Date();
    const since = await utils.getSince(utils.TYPE_COMMITS, days)

    let processed = 0;
    for await (const {octokit, repository} of app.eachRepository.iterator()) {
        const client = octokit;
        console.log(`\n${processed++} repos processed`)
        try {
            console.log(`Retrieving branches for /repos/${owner}/${repository.name}/branches`)
            const branches = await client.paginate("GET /repos/{owner}/{repo}/branches", {
                owner: owner,
                repo: repository.name
            });
            console.log(`Retrieved ${branches.length} branches`)

            for (let branch of branches) {
                console.log(`Retrieving commits for /repos/${owner}/${repository.name}/${branch.name}/commits/`)
                const commits = await client.paginate("GET /repos/{owner}/{repo}/commits", {
                    owner: owner,
                    repo: repository.name,
                    sha: branch.name,
                    since: since,
                });

                console.log(`Retrieved ${commits.length} commmits`)
                for (let commit of commits) {
                    if (commit.author && commit.commit.author.date) {
                        console.log(`${commit.author.login},${commit.commit.author.date},commit,${commit.html_url}`);
                        await database.updateUser(commit.author.login, commit.commit.author.date, "commit", commit.html_url)
                    }
                }
            }
        } catch (e) {
            console.error(e)
        }
    }
    await database.setLastUpdated("commits", commitsLastUpdated.toISOString())
}

main()
