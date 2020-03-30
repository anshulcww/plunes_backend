const mongoose = require('mongoose')
const Notification = require('../models/notification')
const User = require('../models/user')

const textMessage = `ICMR Approved COVID-19 TEST NOW AVAILABLE IN GURGAON. Download PLUNES & BOOK for safe and hygienic collection at home. Up to 50% off. Contact us: 7701805081`
const pushNotificationBody = `Upto 50% OFF in Public Interest. Home Collection Available, No Hassle`
const pushNotificationTitle = `COVID-19 TEST NOW AVAILABLE ON PLUNES!`

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const sendPush = async (title, body, screen, deviceIds) => {
    console.log("Sending push notificaiton", { title, body, screen, deviceIds })
    // await Notification.push(deviceIds, title, body, screen)
    console.log("Sent push notifications")
}

const sendSms = async (mobileNumber, sms) => {
    console.log("Sending sms notificaiton", { mobileNumber, sms })
    // await Notification.sms(mobileNumber, sms)
    console.log("Sent sms notification")
}

const sendNotifications = async () => {
    try {
        const userList = await User.find({userType: "User"}, 'mobileNumber email deviceIds').lean()
        await asyncForEach(userList, async element => {
            await sendPush(pushNotificationTitle, pushNotificationBody, 'solution', element.deviceIds)
            await sendSms(mobileNumber, textMessage)
        })
        console.log("Sent all notifications")
        process.exit(0)
    } catch(e) {
        console.log("Error", e)
    }
}

sendNotifications()