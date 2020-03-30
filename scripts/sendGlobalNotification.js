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

const sendPush = (title, body, screen, deviceIds) => {
    return new Promise(async (resolve, reject) => {
        console.log("Sending push notificaiton", { title, body, screen, deviceIds })
        try {
            // await Notification.push(deviceIds, title, body, screen)
            console.log("Sent push notifications")
            resolve()
        } catch (e) {
            console.log("Error sending push", e)
            reject(e)
        }
    })
}

const sendSms = (mobileNumber, sms) => {
    return new Promise(async (resolve, reject) => {
        console.log("Sending sms notificaiton", { mobileNumber, sms })
        try {
            // await Notification.sms(mobileNumber, sms)
            console.log("Sent sms notification")
            resolve()
        } catch (e) {
            console.log("Error sending SMS", e)
            reject(e)
        }
    })
}

const sendNotifications = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const userList = await User.find({ userType: "User" }, 'mobileNumber email deviceIds').lean()
            await asyncForEach(userList, async element => {
                await sendPush(pushNotificationTitle, pushNotificationBody, 'solution', element.deviceIds)
                await sendSms(mobileNumber, textMessage)
            })
            console.log("Sent all notifications")
            resolve()
        } catch (e) {
            console.log("Error", e)
            reject(e)
        }
    })
}

try {
    await sendNotifications()
    process.exit(0)
} catch (err) {
    console.log("Error", err)
}