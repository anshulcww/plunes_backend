const mongoose = require('mongoose')

const catalogRecordsSchema = mongoose.Schema({
    name: String,
    mobileNumber: String,
    location: String
}, { timestamp: true })

const CatalogRecords = mongoose.model('services', catalogRecordsSchema)

module.exports = CatalogRecords