const github = require("../lib/github")
const database = require('../lib/database')

async function main() {
    const owner = 'org-name'
    const repo = 'github-inactive-user-mentions'

    try {
        const token = github.getAuth().token
        const client = await github.getOctokit(token)
        const members = await client.paginate(client.orgs.listMembers, {
            org: owner,
            role: 'member',
            per_page: 100
        });

        const _outsideCollaborators = await client.paginate(client.orgs.listOutsideCollaborators, {
            org: owner,
            per_page: 100
        })
        const outsideCollaborators = _outsideCollaborators.map(collaborator => collaborator.login)

        const _expiredUsers = await database.getExpiredUsers(members)
        const expiredUsers = _expiredUsers.map(user => user.login)

        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() - 3)

        const issues = await listIssues(client, owner, repo)
        for (let issue of issues) {
            const username = issue.title
            const issueCreated = new Date(issue.created_at)
            if (issueCreated > expirationDate) {
                console.log(`Issue active, waiting to remove user: ${username}`)
                continue
            }

            if (issue.comments > 0) {
                const _comments = await client.paginate(client.issues.listComments, {
                    owner: owner,
                    repo: repo,
                    issue_number: issue.number,
                    per_page: 100
                });
                const commentsUserLogins = _comments.map(comment => comment.user.login)
                if (commentsUserLogins.includes(username)) {
                    console.log(`Preserving user due to comment: ${username}`)
                    await createComment(client, owner, repo, issue.number, preserveAccountComment(username))
                    await addLabels(client, owner, repo, issue.number, ["preserved"])
                    await closeIssue(client, owner, repo, issue.number)
                    continue
                }
            }

            const userExpired = username !== 'ORG-devops-bot' && expiredUsers.includes(username)
            if (userExpired) {
                console.log(`Removing user: ${username}`)
                if (outsideCollaborators.includes(username)) {
                    await removeCollaboratorFromOrg(client, owner, username);
                } else {
                    await removeUserFromOrg(client, owner, username);
                }
                await createComment(client, owner, repo, issue.number, removeAccountComment(username))
                await addLabels(client, owner, repo, issue.number, ["removed"]);
                await closeIssue(client, owner, repo, issue.number);
            } else {
                console.log(`Preserving user due to new activity: ${username}`)
                await createComment(client, owner, repo, issue.number, preserveAccountComment(username))
                await addLabels(client, owner, repo, issue.number, ["preserved"])
                await closeIssue(client, owner, repo, issue.number)
            }
        }
    } catch (e) {
        console.error(e);
    }
}

const listIssues = async (client, owner, repo) => {
    try {
        return client.paginate(client.issues.listForRepo, {
            owner: owner,
            repo: repo,
            state: "open",
            creator: "ORG-devops-bot",
            sort: "created",
            direction: "asc",
            per_page: 100
        })
    } catch (e) {
        throw new Error(`Unable to list issues: ${e.message}`)
    }
}

const preserveAccountComment = (user) => {
    return `@${user} Thank you, I will mark your account active.  Please remember this 90 day audit will be part of the continuous monitoring for GitHub, so please maintain activity of one of the following to avoid be pulled as inactive again.
1. Commits
2. Created issue(s)
3. Created PR(s)
4. Commented on issues
5. Commented on PR’s
The reports are run bi-weekly.`;
}


const removeAccountComment = (user) => {
    return `@${user} you are being removed from the ORG_NAME organization due to inactivity.  If you still require access, please follow the steps outlined in your [GitHub Handbook](https://org-name.github.io/github-handbook/) or send an email to YOUR_EMAIL`;
}

const removeUserFromOrg = async (client, owner, login) => {
    try {
        await client.orgs.removeMembershipForUser({
            org: owner,
            username: login,
        })
    } catch (e) {
        console.error(`Error removing user ${login}: ${e.message}`)
    }
}

const removeCollaboratorFromOrg = async (client, owner, login) => {
    try {
        await client.orgs.removeOutsideCollaborator({
            org: owner,
            username: login,
        });
    } catch (e) {
       console.error(`Error removing collaborator ${login}: ${e.message}`)
    }
}

const createComment = async (client, owner, repo, number, comment) => {
    try {
        await client.issues.createComment({
            owner: owner,
            repo: repo,
            issue_number: number,
            body: comment,
        });
    } catch (e) {
        console.error(`Unable to create comment on issue ${owner}/${repo}#${number}: ${e.message}`)
    }
}

const closeIssue = async (client, owner, repo, number) => {
    try {
        await client.issues.update({
            owner: owner,
            repo: repo,
            issue_number: number,
            state: "closed",
        });
    } catch (e) {
        console.error(`Unable to close issue ${owner}/${repo}#${number}: ${e.message()}`)
    }
}

const addLabels = async (client, owner, repo, number, labels) => {
    try {
        await client.issues.addLabels({
            owner: owner,
            repo: repo,
            issue_number: number,
            labels: labels,
        });
    } catch (e) {
        console.error(`Unable to add labels [${labels}] to ${owner}/${repo}#${number}: ${e.message()}`)
    }
}

main()
