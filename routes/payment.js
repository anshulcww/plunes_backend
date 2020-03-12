const express = require('express')
const mongoose = require('mongoose')

const Config = require('../config')
const User = require('../models/user')
const Booking = require('../models/booking')
const Solution = require('../models/solution')
const Notification = require('../models/notification')
const Catalogue = require('../models/catalogue')
const Redeem =  require('../models/redeem')
const router = express.Router()

const ObjectId = mongoose.Types.ObjectId

function confirmationEmail(patient, doctor, procedure, address, timeSlot, date, contact) {
    const d = date.split(' ')
    const dateStr = '' + d[2] + '-' + d[1] + '-' + d[0]
    return `
Hello ${patient},
Your appointment has been scheduled successfully!
We are happy to confirm your ${procedure} with ${doctor} at ${address}.
Doctor Name:- ${doctor}
Date:- ${dateStr}
Time Slot:- ${timeSlot}
Address:- ${address}
Contact:- ${contact}
Tip:
Please describe your previous medical conditions. (if any)
It could be helpful if you can carry a list of your current medications. (if any)
Thank You for booking through PLUNES. We wish you a fast & healthy recovery.
If you want to reschedule/cancel your appointment, please visit the app.
`
}

router.post("/capture/:bookingId", async (req, res) => {
    try {
        const bookingId = req.params.bookingId
        const booking = await Booking.findBooking(bookingId)
        if (booking) {
            if (req.body.razorpay_payment_id != undefined) {
                const [solutionId, serviceId] = booking.solutionServiceId.split('|')
                await Solution.updateOne({
                    _id: ObjectId(solutionId)
                }, {
                    $set: {
                        booked: true
                    }
                })
                booking.bookingStatus = 'Confirmed'
                booking.razorPaymentId = req.body.razorpay_payment_id
                await booking.save()
                const user = await User.findById(booking.userId)
                if (user) {
                    user.credits -= booking.creditsUsed
                    const notification = new Notification({
                        userId: booking.userId,
                        senderUserId: booking.professionalId,
                        notificationType: 'booking'
                    })
                    await notification.save()
                    await Notification.sms(user.mobileNumber, `Your booking has been confirmed. Please check the details of your appointment in the App.`)

                    if (user.deviceIds.length != 0) {
                        await Notification.push(user.deviceIds, 'Booking confirmed', `Your booking has been confirmed. Please check the details of your appointment in the App.`, 'booking')
                    }
                }
                const professional = await User.findById(booking.professionalId)
                if (professional) {
                    const notification = new Notification({
                        userId: booking.professionalId,
                        senderUserId: booking.userId,
                        notificationType: 'solution'
                    })
                    await notification.save()
                    await Notification.sms(professional.mobileNumber, `You have received a new booking. Please check your appointments.`)
                    if (user.deviceIds.length != 0) {
                        await Notification.push(professional.deviceIds, 'New booking', `You have received a new booking. Please check your appointments.`, 'booking')
                    }
                }
                if (user && professional) {
                    const catalogue = await Catalogue.findServiceId(booking.serviceId)
                    var procedure = ''
                    catalogue.services.forEach(function(service) {
                        if (service._id.toString() == booking.serviceId) {
                            procedure = service.service
                        }
                    })
                    const email = confirmationEmail(user.name, professional.name, procedure, professional.address, booking.appointmentTime.substr(11), booking.appointmentTime.substr(0, 10), professional.mobileNumber)
                    await Notification.email(user.email, 'Plunes: Booking confirmation', email)
                    await Notification.sms(professional.mobileNumber, `${user.name} (${user.mobileNumber}) has booked an appointment for ${procedure[1]} at ${booking.appointmentTime}. Please check the details in the App.`)
                }
                res.redirect(`${Config.RAZORPAY_APP_URL}/payment/success/${bookingId}`)
            } else {
                booking.bookingStatus = 'Failed'
                await booking.save()
                res.redirect(`${Config.RAZORPAY_APP_URL}/payment/error`)
            }
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post("/", async (req, res) => {
    try {
        // console.log('anshul postman')
        const bookingId = req.body.payment_id
        const booking = await Booking.findBooking(bookingId)
        if (booking) {
            const user = await User.findById(booking.userId)
            const paymentPercent = booking.paymentPercent ? booking.paymentPercent : 100
            const paymentAmount = booking.service.newPrice[booking.service.index] - booking.creditsUsed
            res.status(201).send({
                success: true,
                data: {
                    bookingId: bookingId,
                    email: user ? user.email : '',
                    phone_number: user ? user.mobileNumber : '',
                    paymentAmount: parseInt((paymentAmount * paymentPercent) / 100)
                }
            })
        } else {
            res.status(201).send({
                success: false
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get("/success", async (req, res) => {
    res.status(201).send({
        success: true,
        message: 'payment success'
    })
})

router.get("/error", async (req, res) => {
    res.status(201).send({
        success: false,
        message: 'payment failed'
    })
})

router.get("/cancelled/:bookingId", async (req, res) => {
    try {
        const bookingId = req.params.bookingId
        const booking = await Booking.findBooking(bookingId)
        booking.bookingStatus = 'Cancelled'
        await booking.save()
        res.redirect(`${Config.RAZORPAY_APP_URL}/payment/cancelled/${bookingId}`)
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post("/redeem" , async (req, res) => {
    try{
        //console.log(req.body, 'body');
        const redeem = new Redeem(req.body)
        console.log(redeem, 'redeem')
        await redeem.save()
        res.status(201).send({
            success: true,
            message: 'Redeem Initiated'
        })

    }catch(error){
        console.log(error);
        res.status(400).send(error)
    }
})



module.exports = router