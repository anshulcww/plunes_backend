const mongoose = require('mongoose')

const covidSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required :  true
    },
    createdAt: {
        type: Number,
        // default: new Date()
    }
})

const Covid = mongoose.model('covid', covidSchema)

module.exports = Covid
