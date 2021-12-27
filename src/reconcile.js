const database = require('../lib/database')

async function main() {
    try {
        await database.reconcileUsers()
    } catch (error) {
        console.log(error)
    }
}

if (require.main === module) {
    main()
}

module.exports = main
