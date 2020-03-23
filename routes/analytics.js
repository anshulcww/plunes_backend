const express = require('express')
const Service = require('../models/services')
const User = require('../models/user');
const Booking = require('../models/booking')
const Solution = require('../models/solution');
const router = express.Router()
const auth = require('../middleware/auth')

router.get('/solutionSearch', auth, async(req, res) => {
    //console.log('Anshul')
    const user = req.user
    const solution = await Solution.aggregate([
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
        },
        {
            $project: {
                "serviceDoc" : 0
            }
        },
        {$sort: {_id: -1}},
        {$limit: 30}
    ])
    console.log('Anshul 2')
    //console.log(solution, 'solution')
    let solInsights = []
    solution.forEach((s) => {
        //console.log(s.serviceName, 'service name')
        s.services.forEach((se) => {
            if(se.professionalId === user._id.toString()){
                //console.log(true, {se})
                let negotiating = se.negotiating
                if(negotiating){
                    if((Date.now() - s.createdTime) < 600000){
                     negotiating = true
                    }else{
                     negotiating = false
                    }
                }
                
                let obj  = {
                    "solutionId" : s._id,
                    "serviceId" : se._id,
                    "userName" : s.name,
                    "profName" : se.name,
                    "serviceName" : s.serviceName,
                    "negotiating" : negotiating
                }
                solInsights.push(obj)
            }
        })
    })
    res.status(201).send({
        success: true,
        data: solInsights
    })
})

router.get('/solutionInsight',auth, async(req, res) => {
    const user = req.user
    const solution = await Solution.aggregate([
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
        },
        {
            $project: {
                "serviceDoc" : 0
            }
        },
        {$sort: {_id: -1}},
        { $limit : 20 }
    ])
    let insights = []
    let price = []
    let avgPrice = 0
    let totalPrice = 0;
    //console.log(solution, 'solution')
    solution.forEach((s) => {
        //console.log(s.serviceName, 'service name')
        if(user.specialities){
            user.specialities.forEach((sp) => {
                if(sp.services){
                    sp.services.forEach((se) => {
                        // console.log(s.serviceId , se.serviceId)
                        if(s.serviceId.toString() === se.serviceId){
                            //console.log('true')
                            s.services.forEach((s) => {
                                if(s.professionalId !== user._id.toString()){
                                    price.push(s.price[0])
                                }
                            })
                            for(var i =0; i<price.length; i++) {
                                totalPrice = totalPrice + price[i]
                            }
                            if(price.length > 0 ){
                               avgPrice = totalPrice / price.length
                            }
                            let uPrice = se.price[0] - (se.price[0])*se.variance/100 ;
                            let percent = (uPrice - avgPrice)/uPrice * 100
                            //console.log(percent, 'percent' );
                            if(uPrice > avgPrice){
                                //console.log('asnhul')
                                //let percent = (uPrice - avgPrice)/uPrice * 100
                                //console.log(s.serviceName, 'service name')
                                let obj = {
                                    'serviceName' : s.serviceName,
                                    'percent' : Math.floor(percent),
                                    'avgPrice' : Math.floor(avgPrice),
                                    'userPriceVariance' : uPrice,
                                    'specialityId' : sp.specialityId,
                                    'serviceId' : se.serviceId,
                                    'userPrice' : se.price[0]
                                }
                                //console.log(obj, 'obj');
                                insights.push(obj);
                            }
                        }
                    })
                }
            })
        }
    })
    //console.log(insights)
    res.status(201).send({
        success: true,
        data: insights
    })
})



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
                                    'percent' : Math.floor(percent),
                                    'bookingPrice' : bPrice,
                                    'userPriceVariance' : uPrice,
                                    'specialityId' : sp.specialityId,
                                    'serviceId' : se.serviceId,
                                    'userPrice' : se.price[0]
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