const express = require('express')

const Enquiry = require('../models/enquiry')
const User = require('../models/user')
const Notification = require('../models/notification')
const auth = require('../middleware/auth')

const mongoose = require('mongoose')

const ObjectId = mongoose.Types.ObjectId

const router = express.Router()

router.post('/', auth, async (req, res) => {
    try {
        console.log(req.body)
        const enquiry = new Enquiry(req.body)
        enquiry.createdTime = Date.now()
        if (enquiry.fromUserId == enquiry.toUserId) {
            res.status(201).send({
                success: false
            })
        }
        const notification = new Notification({
            userId: enquiry.toUserId,
            senderUserId: enquiry.fromUserId,
            notificationType: 'enquiry'
        })
        await notification.save()
        const fromUser = await User.findById(enquiry.fromUserId)
        const toUser = await User.findById(enquiry.toUserId)
        if (toUser) {
            if (toUser.deviceIds.length != 0) {
                await Notification.push(toUser.deviceIds, fromUser.name,
                    `${fromUser.name} has posted an enquiry for you.`, 'enquiry')
            }
            await enquiry.save()
        }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post('/help', auth, async (req, res) => {
    await Notification.email('support@plunes.com', 'Help Request: ' + req.user.name,
        req.user._id.toString() + '|' + req.user.name + '|' +
        req.user.mobileNumber + '|' + req.body.text)
    res.status(201).send({
        success: true
    })
})

router.get('/', auth, async (req, res) => {
    try {
        const enquiries = await Enquiry.find({
            $or: [{
                fromUserId: req.user._id.toString()
            }, {
                toUserId: req.user._id.toString()
            }]
        }).sort({
            createdTime: -1
        })

        for (var i = 0; i < enquiries.length; i++) {
            const enquiry = enquiries[i]
            const fromUser = await User.findById(enquiry.fromUserId)
            const toUser = await User.findById(enquiry.toUserId)
            if (fromUser && toUser) {
                // console.log(fromUser.imageUrl, toUser.imageUrl)
                enquiry.fromUserName = fromUser.name
                enquiry.fromUserImageUrl = fromUser.imageUrl
                enquiry.toUserName = toUser.name
                enquiry.toUserImageUrl = toUser.imageUrl
            }
            for (var j = 0; j < enquiry.replies.length; j++) {
                const reply = enquiry.replies[j];
                const user = await User.findById(reply.fromUserId)
                if (user) {
                    reply.fromUserName = user.name
                    reply.fromUserImageUrl = user.imageUrl
                }
            }
        }
        // console.log(enquiries)
        res.status(201).send({
            success: true,
            enquiries
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.put('/', auth, async (req, res) => {
    try {
        // console.log(req.body)
        const {
            enquiryId,
            reply
        } = req.body
        // console.log(enquiryId, reply)
        const enquiry = await Enquiry.findOne({
            _id: ObjectId(enquiryId)
        })
        enquiry.replies = enquiry.replies.concat({
            fromUserId: req.user._id.toString(),
            reply: reply,
            createdTime: Date.now()
        })
        await enquiry.save()
        const notification = new Notification({
            userId: enquiry.fromUserId,
            senderUserId: req.user._id.toString(),
            notificationType: 'reply'
        })
        await notification.save()
        const user = await User.find({
            _id: ObjectId(enquiry.fromUserId)
        })
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router