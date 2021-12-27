const github = require("../lib/github");
const utils = require("../lib/utils");
const database = require("../lib/database")

function hasAnyContributions({contributionsCollection: m}) {
    return m.hasAnyContributions || m.hasAnyRestrictedContributions;
}

/**
 * Iterate through all repositories where our GitHub App is installed, and
 * print out all issue comments created since a given time.
 */
async function main() {
    const owner = 'org-name'
    const organizationID = 'MDEyOk9yZ2FuaXphdGlvbjU0MjE1NjM='
    const days = 7

    const token = github.getAuth().token;
    const octokit = github.getOctokit(token);
    const since = await utils.getSince(utils.TYPE_CONTRIBUTIONS, days)

    console.log(`fetching contributions log for ${owner} and ${organizationID} since ${since}`);

    const CONTRIBUTIONS_QUERY = `query(
    $org: String!
    $org_id: ID
    $per_page: Int = 8
    $from: DateTime
    $to: DateTime
    $after: String
  ) {
    organization(login: $org) {
      membersWithRole(first: $per_page, after: $after) {
        nodes {
          login
          contributionsCollection(organizationID: $org_id, from: $from, to: $to) {
            hasAnyContributions
            hasAnyRestrictedContributions
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`;

    const contributionsLastUpdated = new Date();

    let cursor = null;
    let hasNextPage = false;
    do {
        let i = 0;

        try {
            const response = await octokit.graphql(CONTRIBUTIONS_QUERY, {
                org: owner,
                org_id: organizationID,
                after: cursor,
                from: since,
            });

            for (const member of response.organization.membersWithRole.nodes) {
                if (hasAnyContributions(member)) {
                    let lastUpdated = new Date(-2000000)
                    for (let week of member.contributionsCollection.contributionCalendar.weeks) {
                        for (let day of week.contributionDays) {
                            if (day.contributionCount > 0) {
                                const date = new Date(day.date)
                                if (date > lastUpdated) {
                                    lastUpdated = date
                                }
                            }
                        }
                    }
                    console.log([member.login, lastUpdated.toISOString(), "contribution"].join(","));
                    await database.updateUser(member.login, lastUpdated.toISOString(), "contribution")
                }
            }

            cursor = response.organization.membersWithRole.pageInfo.endCursor;
            hasNextPage = response.organization.membersWithRole.pageInfo.hasNextPage;
        } catch (e) {
            console.error(e);
            if (i++ >= 3) {
                throw e;
            }
        }
    } while (hasNextPage);
    await database.setLastUpdated("contributions", contributionsLastUpdated.toISOString())
}

main()
