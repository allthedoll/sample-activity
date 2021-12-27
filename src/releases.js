const github = require("../lib/github");
const utils = require("../lib/utils");
const database = require("../lib/database")

async function main() {
    const owner = 'org-name'
    const days = 7

    const auth = github.getAuth();
    const app = github.getGitHubApp(auth);

    const releasesLastUpdate = new Date();
    const since = await utils.getSince(utils.TYPE_RELEASES, days)

    for await (const {octokit, repository} of app.eachRepository.iterator()) {
        try {
            const releases = await octokit.paginate("GET /repos/{owner}/{repo}/releases", {
                owner: owner,
                repo: repository.name,
            });

            for (let release of releases) {
                if (new Date(release.published_at) < new Date(since)) {
                    break;
                }
                console.log(`${release.author.login},${release.published_at},release,${release.html_url}`);
                await database.updateUser(release.author.login, release.published_at, "release", release.html_url)
            }
        } catch (error) {
            debug(error);
        }
    }
    await database.setLastUpdated("releases", releasesLastUpdate.toISOString())
}

main()
