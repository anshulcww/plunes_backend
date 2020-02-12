const mongoose = require('mongoose')

const enquirySchema = mongoose.Schema({
    fromUserId: {
        type: String,
        required: true
    },
    fromUserName: String,
    fromUserImageUrl: String,
    toUserId: {
        type: String,
        required: true
    },
    toUserName: String,
    toUserImageUrl: String,
    enquiry: {
        type: String,
        required: true
    },
    appreciateCount: Number,
    private: {
        type: Boolean,
        default: false
    },
    createdTime: Number,
    replies: [{
        fromUserId: String,
        fromUserName: String,
        fromUserImageUrl: String,
        reply: String,
        appreciateCount: Number,
        createdTime: Number
    }],
    details: {}
})

const Enquiry = mongoose.model('enquiry', enquirySchema)

module.exports = Enquiry