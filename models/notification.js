const mongoose = require('mongoose')
const request = require('request')
const nodemailer = require('nodemailer')
const FCM = require('fcm-node')
const serverKey = require('../firebase.json')
const fcm = new FCM(serverKey)
const { ENVIRONMENT } = require('../config')

const User = require('./user')

const notificationSchema = mongoose.Schema({
    userId: String,
    senderUserId: String,
    senderName: String,
    senderImageUrl: String,
    notification: String,
    notificationType: String,
    createdTime: Number
})

notificationSchema.pre('save', async function (next) {
    const notification = this

    notification.createdTime = Date.now()

    const user = await User.findById(notification.senderUserId)
    if (user) {
        notification.senderName = user.name
        notification.senderImageUrl = user.imageUrl
        switch (notification.notificationType) {
            case 'enquiry':
                notification.notification = `${notification.senderName} has posted a query for you.`
                break
            case 'reply':
                notification.notification = `${notification.senderName} has posted a comment.`
                break
            case 'solution':
                notification.notification = `${notification.senderName} has requested for a solution.`
                notification.notificationType = 'solution'
                break
            case 'solution update':
                notification.notification = `${notification.senderName} has updated the price of solution.`
                notification.notificationType = 'solution'
                break
            case 'booking':
                notification.notification = `New booking confirmed. Please check your appointments.`
                notification.notificationType = 'booking'
                break
            case 'rescheduled':
                notification.notification = `Booking rescheduled. Please check your appointments.`
                notification.notificationType = 'booking'
                break
            case 'cancelled':
                notification.notification = `Booking cancelled. Please check your appointments.`
                notification.notificationType = 'booking'
                break
            case 'plockr':
                notification.notification = `Hi! Your prescription is now available in your PLOCKR account. Kindly open PLOCKR.`
                notification.notificationType = 'plockr'
                break
        }
    }
})

const Notification = mongoose.model('notification', notificationSchema)

Notification.sms = async function (mobileNumber, sms) {
    console.log("Send SMS notification", { sms, mobileNumber })
    if (ENVIRONMENT === "production") {
        const url = `https://api.msg91.com/api/sendhttp.php?mobiles=${mobileNumber}&authkey=278069AIdfPwGj5ce79990&route=4&sender=PLUNES&message=${sms}&country=91`
        request.get({
            headers: {},
            url: url
        })
    }
}

Notification.email = async function (recipient, subject, text) {
    console.log("Send Email Notification", { recipient, subject, text });
    if (ENVIRONMENT === "production") {
        const transporter = nodemailer.createTransport({
            host: "smtp.zoho.in",
            port: 465,
            secure: true,
            auth: {
                user: "info@plunes.com",
                pass: "Ch@nder123"
            }
        })
        const mailOptions = {
            from: "info@plunes.com",
            to: recipient,
            subject: subject,
            text: text
        }
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        })
    }
}

Notification.push = async function (deviceIds, title, body, screen) {
    console.log("Send push notification", { deviceIds, title, body, screen })
    if (ENVIRONMENT === "production") {
        const message = {
            registration_ids: deviceIds,

            notification: {
                title: title,
                body: body,
                sound: "default"
            },
            data: {
                title: title,
                body: body,
                screen: screen,
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
        }

        fcm.send(message, function (err, response) {
            if (err) {
                console.log('FCM Error:', JSON.stringify(err));
            } else {
                console.log('FCM Response:', JSON.stringify(response));
            }
        })
    }
}

module.exports = Notification
