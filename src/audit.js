const github = require("../lib/github");
const utils = require("../lib/utils");
const database = require("../lib/database")

/**
 * Iterate through all repositories where our GitHub App is installed, and
 * print out all issue comments created since a given time.
 */
async function main() {
    const owner = 'org-name'
    const days = 7

    const token = github.getAuth().token;
    const octokit = github.getOctokit(token);
    const since = await utils.getSince(utils.TYPE_AUDIT, days)

    console.log(`Fetching audit log for ${owner} since ${since}`);

    const AUDIT_QUERY = `query($owner: String!, $per_page: Int = 100, $auditQuery: String!, $after: String) {
    organization(login: $owner) {
      auditLog(
        first: $per_page
        after: $after
        query: $auditQuery
      ) {
        nodes {
          ... on OrgAddMemberAuditEntry {
            __typename
            createdAt
            userLogin
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }`;

    const auditsLastUpdated = new Date();
    const query = `created:>=${since} action:org.add_member`;
    let cursor = null;
    let hasNextPage = false;
    console.log(`Fetching audit log`)
    do {
        let i = 0;
        try {
            const response = await octokit.graphql(AUDIT_QUERY, {
                owner,
                auditQuery: query,
                after: cursor,
            });

            for (const audit of response.organization.auditLog.nodes) {
                const {createdAt, userLogin} = audit;
                console.log(`User found: ${userLogin}`)
                await database.updateUser(userLogin, createdAt, "audit")
            }
            cursor = response.organization.auditLog.pageInfo.endCursor;
            hasNextPage = response.organization.auditLog.pageInfo.hasNextPage;
        } catch (e) {
            console.error(e)
            if (i++ >= 3) {
                throw e;
            }
        }
    } while (hasNextPage);
    await database.setLastUpdated("audit", auditsLastUpdated.toISOString())
}

main()
