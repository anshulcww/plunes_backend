const express = require('express')
const Service = require('../models/services')
const User = require('../models/user')
const Booking = require('../models/booking')
const router = express.Router()
const auth = require('../middleware/auth')



router.get('/insight', auth, async (req, res) => {
    const user = req.user
    const bookings = await Booking.aggregate([
        {
            $match: {
                professionalId: { $ne: user._id.toString() }
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
            $unwind: "$serviceDoc"
        },
        {
            $addFields: {
                "serviceName": "$serviceDoc.service"
            }
        }
    ]);
    let insights = [];
    bookings.forEach((b) => {
        if(user.specialities){
            user.specialities.forEach((sp) => {
                if(sp.services){
                    sp.services.forEach((se) => {
                        if(b.serviceId.toString() === se.serviceId){
                            let bPrice = b.service.price[0];
                            let uPrice = se.price[0] - (se.price[0])*se.variance/100 ;
                            if(uPrice > bPrice){
                                let percent = (uPrice - bPrice)/uPrice * 100
                                let obj = {
                                    'serviceName' : b.serviceName,
                                    'percent' :  Math.floor(percent),
                                    'bookingPrice' : bPrice,
                                    'userPriceVariance' : uPrice,
                                    'serviceName' : b.serviceName,
                                    'specialityId' : sp.specialityId,
                                    'serviceId' : se.serviceId
                                }
                                insights.push(obj);
                            }
                        }
                    })
                }
            })
        }
    })
    res.status(201).send({
        success: true,
        data: insights
    })
})
router.get('/users', async (req, res) => {
    const users = await User.find({}).sort({
        _id: -1
    })
    var data = []
    users.forEach((u) => {
        u.tokens = undefined
        u.password = undefined
        data = data.concat({
            user: u,
            timestamp: u._id.getTimestamp()
        })
    })
    res.status(201).send({
        success: true,
        data: data
    })
})

module.exports = router