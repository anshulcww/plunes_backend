const express = require('express')

const Notification = require('../models/notification')
const auth = require('../middleware/auth')

const router = express.Router()

const applinkSms = `To download from the App Store, visit: https://apps.apple.com/us/app/plunes/id1463747553
To download from the Play Store, visit: https://play.google.com/store/apps/details?id=com.plunes&hl=en_IN`

router.get('/:since', auth, async (req, res) => {
    try {
        const since = req.params.since ? req.params.since : 0
        const notifications = await Notification.find({
            userId: req.user._id.toString(),
            createdTime: {
                $gt: since
            }
        }).sort({
            createdTime: -1
        })
        // console.log(notifications)
        res.status(201).send({
            success: true,
            notifications
        })
    } catch (error) {
        res.status(400).send(error)
    }
})

router.get('/applink/:mobileNumber', async (req, res) => {
    try {
        await Notification.sms(req.params.mobileNumber, applinkSms)
        res.status(201).send({
            success: true
        })
    } catch (error) {
        res.status(400).send(error)
    }
})

router.post('/resume', async (req, res) => {
    console.log(req.body)
    const {
        name,
        email,
        mobileNumber,
        filename
    } = req.body

    await Notification.email('himani@plunes.com', 'Resume upload', `Received resume of ${name} (${email}) (${mobileNumber}) Link: https://plunes.co/v4/public/${filename}`)
    res.status(201).send({
        success: true
    })
})

router.post('/contact', async (req, res) => {
    const {
        name,
        email,
        message
    } = req.body

    await Notification.email('support@plunes.com', 'Contact Us', `Message from ${email}: ${message}`)
    res.status(201).send({
        success: true
    })
})

router.post('/test_push', async (req, res) => {
    try {
        console.log(req.body)
        const deviceIds = req.body.deviceIds
        await Notification.push(deviceIds, 'Test', 'Test', 'test')
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router