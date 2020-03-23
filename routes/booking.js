const express = require('express')
const mongoose = require('mongoose')

const ObjectId = mongoose.Types.ObjectId

const Booking = require('../models/booking')
const User = require('../models/user')
const Solution = require('../models/solution')
const Notification = require('../models/notification')
const Service = require('../models/services')
const Catalogue = require('../models/catalogue')
const auth = require('../middleware/auth')
const { COUPON_CODES } = require('../config')

const couponCodes = COUPON_CODES

const router = express.Router()

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

router.post('/', auth, async (req, res) => {
    console.log("Booking - POST")
    try {
        // console.log(req.body)
        // Set credits to 0 if using coupons
        if (couponCodes.indexOf(req.body.coupon) !== -1) {
            req.body.creditsUsed = 0
        }
        const booking = new Booking(req.body)
        booking.service = await Solution.findSolutionService(booking.solutionServiceId)
        let couponUsed = false
        booking.referenceId = 'PLUNES-' + new Date().toISOString().substr(0, 10) + '-' + parseInt((1000 + Math.random() * 1000))

        // If there are coupons in the request
        if (couponCodes.indexOf(booking.coupon) !== -1) {
            let user = await User.findById(booking.userId)
            // If user has added coupon
            if (couponCodes.indexOf(user.coupons[0]) !== -1) {
                const bookings = await Booking.findBookingsOfUser(booking.userId, 'Confirmed')
                let consultations = 0
                let tests = 0
                // Calculate remaining free tests/consultations from previous bookings
                for (let b of bookings) {
                    let d = await Catalogue.findServiceData(b.serviceId)
                    if (d && (couponCodes.indexOf(b.coupon) !== -1)) {
                        if (d.service.search(/consultation/i) != -1) {
                            consultations++
                        }
                        if (d.service.search(/test/i) != -1 || d.category == 'Test') {
                            tests++
                        }
                    }
                }
                console.log("Previous tests", tests, "Previous consultations", consultations)
                // If there are free tests/consultations available, confirm booking
                let serviceData = await Catalogue.findServiceData(booking.serviceId)
                console.log({serviceData})
                if (serviceData && serviceData.service.search(/consultation/i) != -1 && consultations < 2) {
                    booking.bookingStatus = 'Confirmed'
                    couponUsed = true
                }
                if ((serviceData && serviceData.service.search(/test/i) != -1 || serviceData.category == 'Test') && tests < 1) {
                    booking.bookingStatus = 'Confirmed'
                    couponUsed = true
                }
            }
        }
        // If booking is not confirmed, no coupons used, only credits used
        if (booking.bookingStatus != 'Confirmed' && booking.paymentPercent == '100' && booking.service.newPrice[booking.service.index] == booking.creditsUsed) {
            booking.bookingStatus = 'Confirmed'
        }
        if (booking.bookingStatus == 'Confirmed') {
            const user = await User.findById(booking.userId)
            const professional = await User.findById(booking.professionalId)
            if (user) {
                // Decrement credits if no coupons used
                if (!couponUsed) {
                    user.credits -= booking.creditsUsed
                }
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
                const procedure = await Catalogue.findServiceName(booking.serviceId)
                if (professional) {
                   console.log(procedure, 'procedure');
                    const email = confirmationEmail(user.name, professional.name, procedure, professional.address, booking.appointmentTime.substr(11), booking.appointmentTime.substr(0, 10), professional.mobileNumber)
                    await Notification.email(user.email, 'Plunes: Booking confirmation', email)
                    await Notification.sms(professional.mobileNumber, `${user.name} (${user.mobileNumber}) has booked an appointment for ${procedure[1]} at ${booking.appointmentTime}. Please check the details in the App.`)
                }
                await user.save()
            }
            if (professional) {
                const notification = new Notification({
                    userId: booking.professionalId,
                    senderUserId: booking.userId,
                    notificationType: 'booking'
                })
                await notification.save()
                await Notification.sms(professional.mobileNumber, `You have received a new booking. Please check your appointments.`)
                if (user.deviceIds.length != 0) {
                    await Notification.push(professional.deviceIds, 'New booking', `You have received a new booking. Please check your appointments.`, 'booking')
                }
            }
        }
        await booking.save()
        //console.log({booking})
        res.status(201).send({
            success: true,
            id: booking._id,
            referenceId: booking.referenceId,
            status: booking.bookingStatus,
            couponUsed: couponUsed
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/', auth, async (req, res) => {
    try {
        const bookings = await Booking.aggregate([
            {
                $match: {
                    $or: [{
                        userId: req.user._id.toString()
                    }, {
                        professionalId: req.user._id.toString()
                    }],
                    bookingStatus: 'Confirmed'
                }
            },
            {
                $addFields: {
                    "proId": { "$toObjectId": "$professionalId" },
                    "userId": { "$toObjectId": "$userId" }
                }
            },
            {
                $lookup: {
                    "from": User.collection.name,
                    "localField": "proId",
                    "foreignField": "_id",
                    "as": "professional"
                }
            },
            {
                $lookup: {
                    "from": User.collection.name,
                    "localField": "userId",
                    "foreignField": "_id",
                    "as": "user"
                }
            },
            {
                $addFields: {
                    "serviceId": { "$toObjectId": "$serviceId" }
                }
            },
            {
                $lookup: {
                    "from": Service.collection.name,
                    "localField": "serviceId",
                    "foreignField": "serviceId",
                    "as": "serviceDoc"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $unwind: "$serviceDoc"
            },
            {
                $unwind: "$professional"
            },
            {
                $addFields: {
                    serviceName: "$serviceDoc.service",
                    userName: "$user.name",
                    userLocation: "$user.geoLocation",
                    userImageUrl: "$user.imageUrl",
                    userAddress: "$user.address",
                    userEmail: "$user.email",
                    userMobileNumber: "$user.mobileNumber",
                    professionalName: "$professional.name",
                    professionalLocation: "$professional.geoLocation",
                    professionalImageUrl: "$professional.imageUrl",
                    professionalAddress: "$professional.address",
                    professionalEmail: "$professional.email",
                    professionalMobileNumber: "$professional.mobileNumber"
                }
            },
            {
                $project: {
                    "user": 0,
                    "professional": 0,
                    "serviceDoc": 0
                }
            },
            {
                $sort: { _id: -1 }
            }
        ])
        res.status(201).send({
            success: true,
            bookings: bookings
        })
    } catch (error) {
        res.status(400).send(error)
    }
})

router.put('/', auth, async (req, res) => {
    console.log("Booking - PUT")
    try {
        const {
            bookingId,
            bookingStatus,
            appointmentTime
        } = req.body
        const booking = await Booking.findBooking(bookingId)
        if (!booking) {
            res.status(201).send({
                error: 'invalid booking id'
            })
        } else {
            booking.bookingStatus = bookingStatus
            if (bookingStatus == 'Rescheduled') {
                booking.appointmentTime = appointmentTime
            }
            await booking.save()
           // console.log('Sending notifications ...')
            const user = await User.findById(booking.userId)
            if (user) {
                console.log('User:', user.name)
                const notification = new Notification({
                    userId: booking.userId,
                    senderUserId: booking.professionalId,
                    notificationType: 'rescheduled'
                })
                await notification.save()
                await Notification.sms(user.mobileNumber, `Your booking is rescheduled. Please check your updated appointments in the app.`)
                if (user.deviceIds.length != 0) {
                    await Notification.push(user.deviceIds, 'Rescheduled booking', `Your booking is rescheduled. Please check your updated appointments in the app.`, 'booking')
                }
            }
            const professional = await User.findById(booking.professionalId)
            if (professional) {
             //   console.log('Professional:', professional.name)
                const notification = new Notification({
                    userId: booking.professionalId,
                    senderUserId: booking.userId,
                    notificationType: 'rescheduled'
                })
                await notification.save()
                await Notification.sms(professional.mobileNumber, `Your booking is rescheduled to ${appointmentTime}. Please check your appointments. `)
                if (professional.deviceIds.length != 0) {
                    await Notification.push(professional.deviceIds, 'Rescheduled booking', `Your booking is rescheduled to ${appointmentTime}. Please check your appointments. `, 'rescheduled')
                }
            }
            res.status(201).send({
                success: true
            })
        }
    } catch (error) {
        res.status(400).send(error)
    }
})

router.put('/:bookingId/:bookingStatus', auth, async (req, res) => {
    try {
        const bookingId = req.params.bookingId
        const bookingStatus = req.params.bookingStatus
        const booking = await Booking.findBooking(bookingId)
        if (!booking) {
            res.status(201).send({
                success: false,
                error: 'invalid booking id'
            })
        } else {
            if (bookingStatus == 'cancel') {
                booking.bookingStatus = 'Cancelled'
                const user = await User.findById(booking.userId)
                if (user) {
                    const notification = new Notification({
                        userId: booking.userId,
                        senderUserId: booking.professionalId,
                        notificationType: 'cancelled'
                    })
                    await notification.save()
                    await Notification.sms(user.mobileNumber, `Your booking is cancelled.`)
                    if (user.deviceIds.length != 0) {
                        await Notification.push(user.deviceIds, 'Cancelled booking', `Your booking is cancelled.`, 'booking')
                    }
                }
                const professional = await User.findById(booking.professionalId)
                if (professional) {
                    const notification = new Notification({
                        userId: booking.professionalId,
                        senderUserId: booking.userId,
                        notificationType: 'cancelled'
                    })
                    await notification.save()
                    await Notification.sms(professional.mobileNumber, `Your booking is cancelled. Please check your appointments. `)
                    if (professional.deviceIds.length != 0) {
                        await Notification.push(professional.deviceIds, 'Cancelled booking', `Your booking is cancelled. Please check your appointments. `, 'booking')
                    }
                }

            } else if (bookingStatus == 'reschedule') {
                booking.rescheduled = true
                const {
                    timeSlot,
                    appointmentTime
                } = req.body
                booking.timeSlot = timeSlot
                booking.appointmentTime = appointmentTime
                const user = await User.findById(booking.userId)
                if (user) {
                    const notification = new Notification({
                        userId: booking.userId,
                        senderUserId: booking.professionalId,
                        notificationType: 'rescheduled'
                    })
                    await notification.save()
                    await Notification.sms(user.mobileNumber, `Your booking is rescheduled to ${appointmentTime}.`)
                    if (user.deviceIds.length != 0) {
                        await Notification.push(user.deviceIds, 'Rescheduled booking', `Your booking is rescheduled to ${appointmentTime}.`, 'booking')
                    }
                }
                const professional = await User.findById(booking.professionalId)
                if (professional) {
                    const notification = new Notification({
                        userId: booking.professionalId,
                        senderUserId: booking.userId,
                        notificationType: 'rescheduled'
                    })
                    await notification.save()
                    await Notification.sms(professional.mobileNumber, `Your booking is rescheduled to ${appointmentTime}. Please check your appointments. `)
                    if (professional.deviceIds.length != 0) {
                        await Notification.push(professional.deviceIds, 'Rescheduled booking', `Your booking is rescheduled to ${appointmentTime}. Please check your appointments. `, 'rescheduled')
                    }
                }
            }
            await booking.save()
            res.status(201).send({
                success: true
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/invoice/:bookingId', auth, async (req, res) => {
    try {
        const booking = Booking.findBooking(req.params.bookingId)
        booking.invoice = true
        await booking.save()
        res.status(201).send({
            success: true
        })
    } catch (error) {
        res.status(400).send({
            success: true
        })
    }
})

router.get('/all/:days?', async (req, res) => {
    console.log(`Get bookings for last ${req.params.days} days`)
    try {
        const days = req.params.days ? parseInt(req.params.days) : 200
        var objIdMin = ObjectId.createFromTime(new Date(new Date().setDate(new Date().getDate() - days)) / 1000)
        var objIdMax = ObjectId.createFromTime(Date.now() / 1000)
        var bookings = await Booking.find().sort({ _id: -1 }).lean()
        var count = 0
        bookings.forEach(async (bookingRecord, index) => {
            const userId = bookingRecord.userId
            const doctorId = bookingRecord.professionalId
            const serviceId = bookingRecord.serviceId
            // console.log({ userId, doctorId, serviceId })
            Promise.all([
                await Catalogue.findServiceName(serviceId),
                await User.findMobileNumber(userId, "User"),
                await User.findMobileNumber(doctorId, "Doctor", "Hospital")
            ]).then(resolution => {
                // console.log("Got details", { resolution, serviceId})
                if (resolution[1]) {
                    bookings[index].serviceName = resolution[0] ? resolution[0] : null
                    bookings[index]["userMobileNumber"] = resolution[1].mobileNumber
                    bookings[index]["userName"] = resolution[1].name
                    if (resolution[2]) {
                        bookings[index]["professionalMobileNumber"] = resolution[2].mobileNumber
                        bookings[index]["professionalName"] = resolution[2].name
                        bookings[index]["createdAt"] = bookings[index]._id.getTimestamp()
                    }
                }
                // console.log("Booking Record", bookings[index])
                count++
                let finalArray = bookings.filter(element => element.userMobileNumber)
                if (count === bookings.length) {
                    // console.log("RESOLVING")
                    res.status(201).send({
                        success: true,
                        booking: finalArray,
                        count: finalArray.length
                    })
                }
            })
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            success: false,
            error: error
        })
    }
})

router.get('/info', auth, async (req, res) => {
    console.log("Booking - GET info", req.body)
    try {
        const info = {
            coupons: [],
            count: 0
        }
        for (let coupon of req.user.coupons) {
            console.log("User coupon", coupon)
            if (couponCodes.indexOf(coupon) !== -1) {
                info.coupons = info.coupons.concat({
                    coupon: coupon,
                    consultations: 2,
                    tests: 1
                })
            }
        }
        const bookings = await Booking.findBookingsOfUser(req.user._id.toString(), 'Confirmed')
        for (let b of bookings) {
            info.count++
            if (!b.coupon) {
                continue
            }
            let i = info.coupons.findIndex(c => c.coupon == b.coupon)
            if (i == -1) {
                continue
            }
            let d = await Catalogue.findServiceData(b.serviceId)
            console.log("Catalogue record", d)
            if (d) {
                console.log("Consultation/Test Check", d.service, d.category)
                if (d.service.search(/consultation/i) != -1) {
                    info.coupons[i].consultations--
                    continue
                }
                if (d.service.search(/test/i) != -1 || d.category == 'Test') {
                    info.coupons[i].tests--
                }
            }
        }
        res.status(201).send({
            success: true,
            info
        })
    } catch (error) {
        console.log(error)
        res.status(201).send(error)
    }
})

module.exports = router
