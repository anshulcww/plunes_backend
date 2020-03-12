const mongoose = require('mongoose')

const redeemSchema = mongoose.Schema({
    userName: String,
    serviceName: {
        type: String,
        required: true
    },
    totalAmount: {
        type: String,
        default: 'INR'
    },
    paidAmount: {
        type: String,
        default: 'INR'
    },
    restAmount: {
        type: String,
        default: 'INR'
    },
    appointmentTime: {
        type: String,
        required: true
    },
    bookingId: String,
    creditsUsed: Number,
    bookingStatus : String
})

const Redeem = mongoose.model('redeem', redeemSchema)

module.exports = Redeem
