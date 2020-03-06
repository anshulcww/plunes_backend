const mongoose = require('mongoose')

const paymentSchema = mongoose.Schema({
    userName: String,
    bookingStatus : String,
    serviceName: {
        type: String,
        required: true
    },
    totalAmount: {
        type: String,
        default: 'INR'
    },
    paidAmount : {
        type : String,
        default : 'INR'
    },
    appointmentTime: {
        type: String,
        required: true
    },
    restAmount : Number,
    creditsUsed: Number,
    bookingId : String
})


const Payment = mongoose.model('payment', paymentSchema)

module.exports = Payment
