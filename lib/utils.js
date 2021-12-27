const database = require('./database')

exports.TYPE_AUDIT = "audit"
exports.TYPE_ISSUES = "issues"
exports.TYPE_COMMITS = "commits"
exports.TYPE_CONTRIBUTIONS = "contributions"
exports.TYPE_RELEASES = "releases"

exports.getSince = async (type, days) => {
    try {
        if (days) {
            const d = new Date()
            d.setDate(d.getDate() - days)
            d.setHours(0, 0, 0, 0)
            return d.toISOString()
        }
        const lastUpdated = await database.getLastUpdated(type)
        return new Date(lastUpdated).toISOString()
    } catch (error) {
        throw error
    }
}
