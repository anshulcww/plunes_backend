const mongoose = require('mongoose')

const ObjectId = mongoose.Types.ObjectId

const bookingSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    userName: String,
    userLocation: {
        latitude: Number,
        longitude: Number
    },
    userAddress: String,
    userImageUrl: String,
    professionalId: {
        type: String,
        required: true
    },
    professionalName: String,
    professionalLocation: {
        latitude: Number,
        longitude: Number
    },
    professionalAddress: String,
    professionalImageUrl: String,
    serviceId: {
        type: String,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    paymentPercent: {
        type: String,
        required: true
    },
    bookingStatus: {
        type: String,
        default: 'Requested'
    },
    solutionServiceId: {
        type: String,
        required: true
    },
    service: {},
    timeSlot: {
        type: String,
        required: true
    },
    appointmentTime: {
        type: String,
        required: true
    },
    razorPaymentId: String,
    rescheduled: {
        type: Boolean,
        default: false
    },
    creditsUsed: Number,
    referenceId: String,
    invoice: Boolean,
    coupon: String
})

bookingSchema.statics.findBooking = async (bookingId) => {
    const booking = Booking.findOne({
        _id: ObjectId(bookingId)
    })
    return booking
}

bookingSchema.statics.findBookingsOfUser = async (userId, bookingStatus) => {
    const bookings = Booking.find({
        userId: userId,
        bookingStatus: bookingStatus
    })
    return bookings
}

const Booking = mongoose.model('booking', bookingSchema)

module.exports = Booking
