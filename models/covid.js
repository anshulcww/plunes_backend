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
})

const Covid = mongoose.model('covid', covidSchema)

module.exports = Covid
